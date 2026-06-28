import { Actor, log } from 'apify';
import type { HttpCrawlingContext } from 'crawlee';
import type { HistoricalBar, QuoteRecord } from './types.js';

interface RouterOpts {
    includeHistorical: boolean;
    historicalRange: string;
    historicalInterval: string;
    chartUrl: (symbol: string) => string;
    control: {
        spendingLimitReached: boolean;
        savedQuotes: number;
        seenSymbols: Set<string>;
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

function buildHistory(result: any): HistoricalBar[] {
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

function mapQuote(result: any, opts: RouterOpts): QuoteRecord {
    const m = result?.meta ?? {};
    const price = num(m.regularMarketPrice);
    const prev = num(m.chartPreviousClose ?? m.previousClose);
    const change = price != null && prev != null ? Math.round((price - prev) * 10000) / 10000 : null;
    const changePercent = price != null && prev != null && prev !== 0 ? Math.round((price - prev) / prev * 10000) / 100 : null;
    const history = opts.includeHistorical ? buildHistory(result) : [];

    return {
        symbol: m.symbol ?? '',
        name: m.longName ?? m.shortName ?? null,
        instrumentType: m.instrumentType ?? null,
        currency: m.currency ?? null,
        exchange: m.fullExchangeName ?? m.exchangeName ?? null,
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
        historicalRange: opts.includeHistorical ? opts.historicalRange : null,
        historicalInterval: opts.includeHistorical ? opts.historicalInterval : null,
        historicalCount: history.length,
        history,
        scrapedAt: new Date().toISOString(),
    };
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
                symbols.map((symbol) => ({ url: opts.chartUrl(symbol), userData: { label: 'CHART', symbol } })),
            );
            return;
        }

        // CHART
        const result = data?.chart?.result?.[0];
        const err = data?.chart?.error;
        if (err || !result) {
            log.warning(`No chart data for ${request.userData.symbol}: ${err?.description ?? 'empty result'}`);
            return;
        }
        const record = mapQuote(result, opts);
        const symbolKey = record.symbol.trim().toUpperCase();
        if (opts.control.seenSymbols.has(symbolKey)) {
            log.debug(`Skipping duplicate quote for ${record.symbol}.`);
            return;
        }

        opts.control.seenSymbols.add(symbolKey);
        try {
            const chargeResult = await Actor.pushData(record, 'quote-scraped');
            const recordWasSaved = chargeResult.chargedCount > 0 || !chargeResult.eventChargeLimitReached;
            if (recordWasSaved) {
                opts.control.savedQuotes += 1;
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
