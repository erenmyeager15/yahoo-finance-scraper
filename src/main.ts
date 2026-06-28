import { Actor, log } from 'apify';
import { HttpCrawler } from 'crawlee';
import type { ActorInput } from './types.js';
import { buildRouter } from './routes.js';

await Actor.init();

const input = ((await Actor.getInput<ActorInput>()) ?? {}) as ActorInput;
const {
    symbols = [],
    searchQueries = [],
    includeHistorical = false,
    historicalRange = '1mo',
    historicalInterval = '1d',
    proxyConfiguration: proxyInput,
} = input;

const cleanSymbols = [...new Set(symbols.map((s) => s.trim().toUpperCase()).filter(Boolean))];
const cleanQueries = searchQueries.map((q) => q.trim()).filter(Boolean);

if (cleanSymbols.length === 0 && cleanQueries.length === 0) {
    log.error('No input. Provide stock/crypto symbols (e.g. "AAPL", "BTC-USD") or search queries.');
    await Actor.exit();
}

log.info(`Starting Yahoo Finance scrape: ${cleanSymbols.length} symbol(s), ${cleanQueries.length} search(es).`);

const proxyConfiguration = (proxyInput?.useApifyProxy || proxyInput?.proxyUrls?.length)
    ? await Actor.createProxyConfiguration(proxyInput)
    : undefined;

function chartUrl(symbol: string): string {
    const params = new URLSearchParams({ interval: historicalInterval, range: includeHistorical ? historicalRange : '5d' });
    return `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?${params.toString()}`;
}

const startRequests = [
    ...cleanSymbols.map((symbol) => ({
        url: chartUrl(symbol),
        userData: { label: 'CHART' as const, symbol },
    })),
    ...cleanQueries.map((q) => ({
        url: `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=5&newsCount=0`,
        userData: { label: 'SEARCH' as const, query: q },
    })),
];

const control = {
    spendingLimitReached: false,
    savedQuotes: 0,
    seenSymbols: new Set<string>(),
};

const router = buildRouter({ includeHistorical, historicalRange, historicalInterval, chartUrl, control });

const crawler = new HttpCrawler({
    proxyConfiguration,
    requestHandler: router,
    additionalMimeTypes: ['application/json'],
    maxConcurrency: 10,
    maxRequestRetries: 5,
    requestHandlerTimeoutSecs: 60,
    retryOnBlocked: true,
    sessionPoolOptions: { maxPoolSize: 50, sessionOptions: { maxUsageCount: 30 } },
    failedRequestHandler: async ({ request }, error) => {
        if (control.spendingLimitReached) return;
        log.warning(`Failed: ${request.url} - ${(error as Error)?.message ?? error}`);
    },
});

await crawler.run(startRequests);
if (!control.spendingLimitReached) {
    await Actor.setStatusMessage(`Finished with ${control.savedQuotes} unique quote(s).`);
    log.info(`Yahoo Finance scrape finished with ${control.savedQuotes} unique quote(s).`);
}
await Actor.exit();
