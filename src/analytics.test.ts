import assert from 'node:assert/strict';
import test from 'node:test';
import { addAnalytics, maxDrawdown, relativeStrengthIndex, returnVolatility, simpleMovingAverage } from './analytics.js';
import type { HistoricalBar, QuoteRecord } from './types.js';

function bars(values: number[]): HistoricalBar[] {
    return values.map((close, index) => ({
        date: new Date(Date.UTC(2026, 0, index + 1)).toISOString(),
        open: close,
        high: close,
        low: close,
        close,
        adjClose: close,
        volume: 1000 + index,
    }));
}

function quote(history: HistoricalBar[]): QuoteRecord {
    return {
        symbol: 'AAPL', name: 'Apple Inc.', instrumentType: 'EQUITY', currency: 'USD', exchange: 'NasdaqGS',
        exchangeTimezone: 'America/New_York', marketState: 'REGULAR', price: 190, previousClose: 188,
        change: 2, changePercent: 1.06, dayHigh: 191, dayLow: 187, fiftyTwoWeekHigh: 200,
        fiftyTwoWeekLow: 100, volume: 1000000, marketTime: '2026-01-31T20:00:00.000Z',
        sourceUrl: 'https://finance.yahoo.com/quote/AAPL', historicalRange: '3mo', historicalInterval: '1d',
        historicalCount: history.length, sma20: null, sma50: null, rsi14: null, returnVolatilityPercent: null,
        maxDrawdownPercent: null, positionIn52WeekRangePercent: null, distanceFrom52WeekHighPercent: null,
        distanceFrom52WeekLowPercent: null, history, scrapedAt: '2026-01-31T20:01:00.000Z',
    };
}

test('calculates moving averages and RSI without inventing unavailable values', () => {
    const values = Array.from({ length: 50 }, (_, index) => 100 + index);
    assert.equal(simpleMovingAverage(values, 20), 139.5);
    assert.equal(simpleMovingAverage(values.slice(0, 10), 20), null);
    assert.equal(relativeStrengthIndex(values), 100);
    assert.equal(relativeStrengthIndex([100, 100, 100]), null);
});

test('calculates observed-period risk metrics', () => {
    assert.equal(maxDrawdown([100, 120, 90, 110]), -25);
    assert.equal(maxDrawdown([100]), null);
    assert.ok((returnVolatility([100, 110, 99, 108]) ?? 0) > 0);
});

test('enriches a quote with history and 52-week position analytics', () => {
    const enriched = addAnalytics(quote(bars(Array.from({ length: 60 }, (_, index) => 130 + index))));
    assert.equal(enriched.positionIn52WeekRangePercent, 90);
    assert.equal(enriched.distanceFrom52WeekHighPercent, -5);
    assert.equal(enriched.distanceFrom52WeekLowPercent, 90);
    assert.notEqual(enriched.sma20, null);
    assert.notEqual(enriched.sma50, null);
    assert.notEqual(enriched.rsi14, null);
});
