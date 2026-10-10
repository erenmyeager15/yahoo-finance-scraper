import assert from 'node:assert/strict';
import test from 'node:test';
import { buildChangeCsv, buildChangeReport } from './report.js';
import type { QuoteRecord } from './types.js';

function quote(overrides: Partial<QuoteRecord> = {}): QuoteRecord {
    return {
        symbol: 'AAPL', name: 'Apple Inc.', instrumentType: 'EQUITY', currency: 'USD', exchange: 'NasdaqGS',
        exchangeTimezone: 'America/New_York', marketState: 'CLOSED', price: 190, previousClose: 188,
        change: 2, changePercent: 1.06, dayHigh: 191, dayLow: 187, fiftyTwoWeekHigh: 200,
        fiftyTwoWeekLow: 100, volume: 1000000, marketTime: '2026-01-31T20:00:00.000Z',
        sourceUrl: 'https://finance.yahoo.com/quote/AAPL', historicalRange: null, historicalInterval: null,
        historicalCount: 0, sma20: null, sma50: null, rsi14: null, returnVolatilityPercent: null,
        maxDrawdownPercent: null, positionIn52WeekRangePercent: 90, distanceFrom52WeekHighPercent: -5,
        distanceFrom52WeekLowPercent: 90, history: [], scrapedAt: '2026-01-31T20:01:00.000Z',
        monitorName: 'US watchlist', monitoringStatus: 'updated', changeSeverity: 'medium',
        previousPrice: 180, priceDelta: 10, priceDeltaPercent: 5.56, previousVolume: 900000,
        volumeDelta: 100000, volumeDeltaPercent: 11.11, changedFields: ['price'],
        changeSignals: ['price_increased', 'price_threshold_crossed'],
        ...overrides,
    };
}

test('builds readable Markdown and spreadsheet-ready CSV reports', () => {
    const markdown = buildChangeReport([quote()], 'US watchlist');
    const csv = buildChangeCsv([quote()]);
    assert.match(markdown, /Updated: \*\*1\*\*/);
    assert.match(markdown, /price_threshold_crossed/);
    assert.match(csv, /"priceDeltaPercent"/);
    assert.match(csv, /"5.56"/);
});

test('neutralizes spreadsheet formulas in text fields without converting numeric negatives', () => {
    const csv = buildChangeCsv([quote({ name: '=WEBSERVICE("https://example.invalid")', maxDrawdownPercent: -25 })]);
    assert.match(csv, /"'=WEBSERVICE\(""https:\/\/example\.invalid""\)"/);
    assert.match(csv, /"-25"/);
});
