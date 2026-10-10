import { Actor, log } from 'apify';
import type { HttpCrawlingContext } from 'crawlee';
import { addAnalytics } from './analytics.js';
import { applyMonitoring, monitoringRecordKey, type MonitoringOptions } from './monitoring.js';
import type { HistoricalBar, QuoteMonitoringState, QuoteRecord } from './types.js';

interface MonitoringStore {
    getValue<T>(key: string): Promise<T | null>;
    setValue<T>(key: string, value: T): Promise<void>;
}

interface RouterOpts {
    includeHistorical: boolean;
    historicalRange: string;
    historicalInterval: string;
    quoteUrl: (symbol: string) => string;
    initialChartRequest: (symbol: string) => { url: string; userData: { label: 'CHART' | 'HISTORY'; symbol: string } };
    monitoringOptions: MonitoringOptions | null;
    monitoringStore: MonitoringStore | null;
    control: {
        spendingLimitReached: boolean;
        savedQuotes: number;
        seenSymbols: Set<string>;
        pendingHistories: Map<string, HistoricalBar[]>;
        savedRecords: QuoteRecord[];
        failedRequests: number;
        emptyResponses: number;
        historyFallbacks: number;
        stateReadFailures: number;
        stateWriteFailures: number;
        monitoringStatusCounts: Record<'baseline' | 'updated' | 'unchanged' | 'partial', number>;
    };
}

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

function parseBody(ctx: HttpCrawlingContext): any {
    const anyCtx = ctx as any;
    if (anyCtx.json !== undefined && anyCtx.json !== null) return anyCtx.json;
    const raw = ctx.body?.toString?.() ?? '';
    const t = raw.trim();
    if (!t.startsWith('{') && !t.startsWith('[')) throw new Error('Non-JSON response (blocked/rate-limited). Rotating session.');
    return JSON.parse(t);
}

export function buildHistory(result: any): HistoricalBar[] {
    const ts: number[] = Array.isArray(result?.timestamp) ? result.timestamp : [];
    const q = result?.indicators?.quote?.[0] ?? {};
    const adj = result?.indicators?.adjclose?.[0]?.adjclose ?? [];
    const bars: HistoricalBar[] = [];
    for (let i = 0; i < ts.length; i++) {
        const close = num(q.close?.[i]);
        const open = num(q.open?.[i]);
        const high = num(q.high?.[i]);
        const low = num(q.low?.[i]);
        const volume = num(q.volume?.[i]);
        // Skip empty rows (Yahoo returns nulls for non-trading timestamps).
        if (close == null && open == null && high == null && low == null) continue;
        bars.push({
            date: new Date(ts[i] * 1000).toISOString(),
            open,
            high,
            low,
            close,
            adjClose: num(adj?.[i]),
            volume,
        });
    }
    return bars;
}

export function mapQuote(result: any, opts: RouterOpts, historicalOverride?: HistoricalBar[]): QuoteRecord {
    const m = result?.meta ?? {};
    const price = num(m.regularMarketPrice);
    const quoteBars = buildHistory(result);
    // Yahoo's `chartPreviousClose` is the close before the requested range, not the
    // previous trading day. Every quote request contains daily bars, so the prior
    // daily bar is the most reliable source for a true previous close.
    const priorDailyBar = quoteBars.length >= 2 ? quoteBars.at(-2)?.close ?? null : null;
    const prev = priorDailyBar ?? num(m.previousClose ?? m.regularMarketPreviousClose ?? m.chartPreviousClose);
    const change = price != null && prev != null ? Math.round((price - prev) * 10000) / 10000 : null;
    const changePercent = price != null && prev != null && prev !== 0 ? Math.round((price - prev) / prev * 10000) / 100 : null;
    const history = opts.includeHistorical ? (historicalOverride ?? quoteBars) : [];

    return addAnalytics({
        symbol: m.symbol ?? '',
        name: m.longName ?? m.shortName ?? null,
        instrumentType: m.instrumentType ?? null,
        currency: m.currency ?? null,
        exchange: m.fullExchangeName ?? m.exchangeName ?? null,
        exchangeTimezone: m.exchangeTimezoneName ?? null,
        marketState: m.marketState ?? null,
        price,
        previousClose: prev,
        change,
        changePercent,
        dayHigh: num(m.regularMarketDayHigh),
        dayLow: num(m.regularMarketDayLow),
        fiftyTwoWeekHigh: num(m.fiftyTwoWeekHigh),
        fiftyTwoWeekLow: num(m.fiftyTwoWeekLow),
        volume: num(m.regularMarketVolume),
        marketTime: typeof m.regularMarketTime === 'number' ? new Date(m.regularMarketTime * 1000).toISOString() : null,
        sourceUrl: `https://finance.yahoo.com/quote/${encodeURIComponent(m.symbol ?? '')}`,
        historicalRange: opts.includeHistorical ? opts.historicalRange : null,
        historicalInterval: opts.includeHistorical ? opts.historicalInterval : null,
        historicalCount: history.length,
        sma20: null,
        sma50: null,
        rsi14: null,
        returnVolatilityPercent: null,
        maxDrawdownPercent: null,
        positionIn52WeekRangePercent: null,
        distanceFrom52WeekHighPercent: null,
        distanceFrom52WeekLowPercent: null,
        history,
        scrapedAt: new Date().toISOString(),
    });
}

export function validateQuoteRecord(record: QuoteRecord): string[] {
    const issues: string[] = [];
    if (!record.symbol.trim()) issues.push('symbol is missing');
    if (record.price === null && record.historicalCount === 0) issues.push('price and historical data are both missing');
    if (record.historicalCount !== record.history.length) issues.push('historical count does not match the history array');
    try {
        const source = new URL(record.sourceUrl);
        if (source.protocol !== 'https:' || source.hostname !== 'finance.yahoo.com') issues.push('source URL is not Yahoo Finance');
    } catch {
        issues.push('source URL is invalid');
    }
    return issues;
}

export function buildRouter(opts: RouterOpts) {
    return async (ctx: HttpCrawlingContext): Promise<void> => {
        const { request, crawler } = ctx;
        if (opts.control.spendingLimitReached) {
            await crawler.autoscaledPool?.abort();
            return;
        }

        const data = parseBody(ctx);
        const label = (request.userData.label as string) ?? 'CHART';

        if (label === 'SEARCH') {
            const query = request.userData.query as string;
            const quotes: any[] = Array.isArray(data?.quotes) ? data.quotes : [];
            const symbols = quotes.map((q) => q.symbol).filter((s) => typeof s === 'string');
            if (symbols.length === 0) {
                log.warning(`No symbols found for search "${query}".`);
                return;
            }
            log.info(`Search "${query}" -> ${symbols.join(', ')}`);
            await crawler.addRequests(
                symbols.map((symbol) => opts.initialChartRequest(symbol)),
            );
            return;
        }

        if (label === 'HISTORY') {
            const historyResult = data?.chart?.result?.[0];
            const historyError = data?.chart?.error;
            const symbol = String(request.userData.symbol ?? '').trim().toUpperCase();
            if (historyError || !historyResult) {
                opts.control.emptyResponses += 1;
                log.warning(`No historical data for ${symbol}: ${historyError?.description ?? 'empty result'}`);
                opts.control.historyFallbacks += 1;
                await crawler.addRequests([{
                    url: opts.quoteUrl(symbol),
                    userData: { label: 'CHART', symbol },
                }]);
                return;
            }
            opts.control.pendingHistories.set(symbol, buildHistory(historyResult));
            await crawler.addRequests([{
                url: opts.quoteUrl(symbol),
                userData: { label: 'CHART', symbol },
            }]);
            return;
        }

        // CHART
        const result = data?.chart?.result?.[0];
        const err = data?.chart?.error;
        if (err || !result) {
            opts.control.emptyResponses += 1;
            log.warning(`No chart data for ${request.userData.symbol}: ${err?.description ?? 'empty result'}`);
            return;
        }
        const requestedSymbol = String(request.userData.symbol ?? '').trim().toUpperCase();
        const historicalOverride = opts.control.pendingHistories.get(requestedSymbol);
        let record = mapQuote(result, opts, historicalOverride);
        const recordIssues = validateQuoteRecord(record);
        if (recordIssues.length > 0) {
            throw new Error(`Yahoo returned an incomplete quote for ${requestedSymbol || 'the requested symbol'}: ${recordIssues.join('; ')}.`);
        }
        const symbolKey = record.symbol.trim().toUpperCase();
        if (opts.control.seenSymbols.has(symbolKey)) {
            log.debug(`Skipping duplicate quote for ${record.symbol}.`);
            return;
        }

        let pendingState: { key: string; state: QuoteMonitoringState } | null = null;
        if (opts.monitoringStore && opts.monitoringOptions) {
            const key = monitoringRecordKey(symbolKey);
            let previousState: QuoteMonitoringState | null = null;
            try {
                previousState = await opts.monitoringStore.getValue<QuoteMonitoringState>(key);
            } catch (error) {
                opts.control.stateReadFailures += 1;
                log.warning(`Could not read private history for ${record.symbol}; using a fresh baseline.`, {
                    error: (error as Error).message,
                });
            }
            const monitored = applyMonitoring(record, previousState, opts.monitoringOptions);
            record = monitored.record;
            pendingState = { key, state: monitored.nextState };
        }

        opts.control.seenSymbols.add(symbolKey);
        opts.control.pendingHistories.delete(requestedSymbol);
        try {
            const chargeResult = await Actor.pushData(record, 'quote-scraped');
            const recordWasSaved = chargeResult.chargedCount > 0 || !chargeResult.eventChargeLimitReached;
            if (recordWasSaved) {
                opts.control.savedQuotes += 1;
                opts.control.savedRecords.push(record);
                if (record.monitoringStatus) opts.control.monitoringStatusCounts[record.monitoringStatus] += 1;
                if (opts.monitoringStore && pendingState) {
                    try {
                        await opts.monitoringStore.setValue(pendingState.key, pendingState.state);
                    } catch (error) {
                        opts.control.stateWriteFailures += 1;
                        log.warning(`Saved ${record.symbol}, but could not update its private history.`, {
                            error: (error as Error).message,
                        });
                    }
                }
            }

            if (chargeResult.eventChargeLimitReached) {
                opts.control.spendingLimitReached = true;
                const message = `Stopped at the user's spending limit after ${opts.control.savedQuotes} quote(s).`;
                await Actor.setStatusMessage(message);
                log.warning(message);
                await crawler.autoscaledPool?.abort();
                return;
            }
        } catch (error) {
            opts.control.seenSymbols.delete(symbolKey);
            throw error;
        }

        log.info(`${record.symbol}: ${record.price ?? 'n/a'} ${record.currency ?? ''} (${record.changePercent ?? 0}%)${record.historicalCount ? ` + ${record.historicalCount} bars` : ''}`);
    };
}
