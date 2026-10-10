import { Actor, log } from 'apify';
import { HttpCrawler } from 'crawlee';
import type { ActorInput, HistoricalBar, QuoteRecord } from './types.js';
import { buildRouter } from './routes.js';
import { monitoringStoreName } from './monitoring.js';
import { buildChangeCsv, buildChangeReport } from './report.js';

await Actor.init();

const input = ((await Actor.getInput<ActorInput>()) ?? {}) as ActorInput;
const {
    symbols = [],
    searchQueries = [],
    includeHistorical = false,
    historicalRange = '1mo',
    historicalInterval = '1d',
    trackChanges = true,
    monitorName = 'us-market-watchlist',
    observationHistoryLimit = 10,
    priceChangePercentThreshold = 2,
    volumeChangePercentThreshold = 50,
    near52WeekBoundaryPercent = 2,
    proxyConfiguration: proxyInput,
} = input;

if (!Array.isArray(symbols) || symbols.some((symbol) => typeof symbol !== 'string')) {
    throw new Error('Ticker symbols must be a list of strings.');
}
if (!Array.isArray(searchQueries) || searchQueries.some((query) => typeof query !== 'string')) {
    throw new Error('Search queries must be a list of strings.');
}

const cleanSymbols = [...new Set(symbols.map((s) => s.trim().toUpperCase()).filter(Boolean))];
const cleanQueries = [...new Set(searchQueries.map((q) => q.trim()).filter(Boolean))];
const cleanMonitorName = monitorName.trim();

if (cleanSymbols.length > 250 || cleanQueries.length > 50) {
    throw new Error('Input is too large. Use at most 250 ticker symbols and 50 search queries per run.');
}
if (trackChanges && !cleanMonitorName) throw new Error('Monitor name cannot be empty when change tracking is enabled.');
if (!Number.isFinite(observationHistoryLimit) || observationHistoryLimit < 2 || observationHistoryLimit > 50) {
    throw new Error('Observation history limit must be between 2 and 50.');
}
for (const [label, value] of [
    ['Price change threshold', priceChangePercentThreshold],
    ['Volume change threshold', volumeChangePercentThreshold],
] as const) {
    if (!Number.isFinite(value) || value < 0 || value > 1000) throw new Error(`${label} must be between 0 and 1000.`);
}
if (!Number.isFinite(near52WeekBoundaryPercent) || near52WeekBoundaryPercent < 0 || near52WeekBoundaryPercent > 100) {
    throw new Error('52-week boundary threshold must be between 0 and 100.');
}
const allowedRanges = new Set(['1d', '5d', '1mo', '3mo', '6mo', '1y', '2y', '5y', '10y', 'ytd', 'max']);
const allowedIntervals = new Set(['1m', '5m', '15m', '30m', '60m', '1d', '1wk', '1mo']);
if (!allowedRanges.has(historicalRange)) throw new Error(`Unsupported historical range: ${historicalRange}.`);
if (!allowedIntervals.has(historicalInterval)) throw new Error(`Unsupported historical interval: ${historicalInterval}.`);

if (cleanSymbols.length === 0 && cleanQueries.length === 0) {
    throw new Error('No input. Provide stock/crypto symbols (e.g. "AAPL", "BTC-USD") or search queries.');
}

log.info(`Starting Yahoo Finance scrape: ${cleanSymbols.length} symbol(s), ${cleanQueries.length} search(es).`);

const proxyConfiguration = (proxyInput?.useApifyProxy || proxyInput?.proxyUrls?.length)
    ? await Actor.createProxyConfiguration(proxyInput)
    : undefined;

function quoteUrl(symbol: string): string {
    const params = new URLSearchParams({ interval: '1d', range: '5d' });
    return `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?${params.toString()}`;
}

function historyUrl(symbol: string): string {
    const params = new URLSearchParams({ interval: historicalInterval, range: historicalRange });
    return `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?${params.toString()}`;
}

function initialChartRequest(symbol: string) {
    if (includeHistorical && historicalInterval !== '1d') {
        return { url: historyUrl(symbol), userData: { label: 'HISTORY' as const, symbol } };
    }
    return {
        url: includeHistorical ? historyUrl(symbol) : quoteUrl(symbol),
        userData: { label: 'CHART' as const, symbol },
    };
}

const startRequests = [
    ...cleanSymbols.map(initialChartRequest),
    ...cleanQueries.map((q) => ({
        url: `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=5&newsCount=0`,
        userData: { label: 'SEARCH' as const, query: q },
    })),
];

const control = {
    spendingLimitReached: false,
    savedQuotes: 0,
    seenSymbols: new Set<string>(),
    pendingHistories: new Map<string, HistoricalBar[]>(),
    savedRecords: [] as QuoteRecord[],
    failedRequests: 0,
    emptyResponses: 0,
    historyFallbacks: 0,
    stateReadFailures: 0,
    stateWriteFailures: 0,
    monitoringStatusCounts: { baseline: 0, updated: 0, unchanged: 0, partial: 0 },
};

const monitoringOptions = trackChanges ? {
    monitorName: cleanMonitorName,
    historyLimit: Math.floor(observationHistoryLimit),
    priceChangePercentThreshold,
    volumeChangePercentThreshold,
    near52WeekBoundaryPercent,
} : null;
const monitoringStore = monitoringOptions
    ? await Actor.openKeyValueStore(monitoringStoreName(cleanMonitorName))
    : null;

const router = buildRouter({
    includeHistorical,
    historicalRange,
    historicalInterval,
    quoteUrl,
    initialChartRequest,
    monitoringOptions,
    monitoringStore,
    control,
});

const crawler = new HttpCrawler({
    proxyConfiguration,
    requestHandler: router,
    additionalMimeTypes: ['application/json'],
    maxConcurrency: 5,
    maxRequestRetries: 5,
    requestHandlerTimeoutSecs: 60,
    retryOnBlocked: Boolean(proxyConfiguration),
    useSessionPool: Boolean(proxyConfiguration),
    sessionPoolOptions: proxyConfiguration
        ? { maxPoolSize: 25, sessionOptions: { maxUsageCount: 30 } }
        : undefined,
    failedRequestHandler: async ({ request, crawler: failedCrawler }, error) => {
        if (control.spendingLimitReached) return;
        control.failedRequests += 1;
        log.warning(`Failed: ${request.url} - ${(error as Error)?.message ?? error}`);
        if (request.userData.label === 'HISTORY') {
            const symbol = String(request.userData.symbol ?? '').trim().toUpperCase();
            if (symbol && !control.seenSymbols.has(symbol)) {
                control.historyFallbacks += 1;
                log.warning(`Historical data failed for ${symbol}; continuing with its current quote.`);
                await failedCrawler.addRequests([{
                    url: quoteUrl(symbol),
                    userData: { label: 'CHART', symbol },
                }]);
            }
        }
    },
});

await crawler.run(startRequests);
if (!control.spendingLimitReached && control.savedQuotes === 0) {
    throw new Error(`No quotes were saved. Failed requests: ${control.failedRequests}; empty Yahoo responses: ${control.emptyResponses}. Check the symbols and try again.`);
}

await Actor.setValue('RUN_SUMMARY', {
    generatedAt: new Date().toISOString(),
    savedQuotes: control.savedQuotes,
    requestedSymbols: cleanSymbols.length,
    searchQueries: cleanQueries.length,
    failedRequests: control.failedRequests,
    emptyResponses: control.emptyResponses,
    historyFallbacks: control.historyFallbacks,
    stoppedByChargeLimit: control.spendingLimitReached,
    changeTracking: {
        enabled: trackChanges,
        monitorName: trackChanges ? cleanMonitorName : null,
        historyLimit: trackChanges ? Math.floor(observationHistoryLimit) : null,
        statusCounts: control.monitoringStatusCounts,
        stateReadFailures: control.stateReadFailures,
        stateWriteFailures: control.stateWriteFailures,
    },
});

if (trackChanges) {
    await Actor.setValue('CHANGE_REPORT', buildChangeReport(control.savedRecords, cleanMonitorName), {
        contentType: 'text/markdown; charset=utf-8',
    });
    await Actor.setValue('CHANGE_REPORT_CSV', buildChangeCsv(control.savedRecords), {
        contentType: 'text/csv; charset=utf-8',
    });
}

if (!control.spendingLimitReached) {
    const updates = control.monitoringStatusCounts.updated;
    const suffix = trackChanges ? `; ${updates} configured update(s)` : '';
    await Actor.setStatusMessage(`Finished with ${control.savedQuotes} unique quote(s)${suffix}.`);
    log.info(`Yahoo Finance scrape finished with ${control.savedQuotes} unique quote(s)${suffix}.`);
}
await Actor.exit();
