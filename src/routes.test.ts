import assert from 'node:assert/strict';
import test from 'node:test';
import { mapQuote, validateQuoteRecord } from './routes.js';

function options(includeHistorical = false): any {
    return {
        includeHistorical,
        historicalRange: '3mo',
        historicalInterval: '1d',
        quoteUrl: () => '',
        initialChartRequest: (symbol: string) => ({ url: '', userData: { label: 'CHART', symbol } }),
        monitoringOptions: null,
        monitoringStore: null,
        control: {},
    };
}

test('uses the actual previous close instead of the chart-range starting close', () => {
    const record = mapQuote({
        meta: {
            symbol: 'TEST',
            regularMarketPrice: 110,
            previousClose: 100,
            chartPreviousClose: 80,
        },
        timestamp: [],
        indicators: { quote: [{}] },
    }, options(true));
    assert.equal(record.previousClose, 100);
    assert.equal(record.change, 10);
    assert.equal(record.changePercent, 10);
});

test('falls back to chart previous close only when quote previous close is missing', () => {
    const record = mapQuote({
        meta: { symbol: 'TEST', regularMarketPrice: 110, chartPreviousClose: 80 },
        timestamp: [],
        indicators: { quote: [{}] },
    }, options());
    assert.equal(record.previousClose, 80);
});

test('derives previous close from the prior daily bar before chart-range metadata', () => {
    const record = mapQuote({
        meta: { symbol: 'TEST', regularMarketPrice: 110, chartPreviousClose: 80 },
        timestamp: [1, 2],
        indicators: { quote: [{ close: [105, 110], open: [104, 109], high: [106, 111], low: [103, 108] }] },
    }, options(true));
    assert.equal(record.previousClose, 105);
    assert.equal(record.changePercent, 4.76);
});

test('keeps requested non-daily history while daily bars determine quote change', () => {
    const weeklyHistory = [{
        date: '2026-01-01T00:00:00.000Z', open: 90, high: 95, low: 88, close: 94, adjClose: 94, volume: 500,
    }];
    const record = mapQuote({
        meta: { symbol: 'TEST', regularMarketPrice: 110, chartPreviousClose: 80 },
        timestamp: [1, 2],
        indicators: { quote: [{ close: [105, 110], open: [104, 109], high: [106, 111], low: [103, 108] }] },
    }, options(true), weeklyHistory);
    assert.equal(record.previousClose, 105);
    assert.deepEqual(record.history, weeklyHistory);
    assert.equal(record.historicalCount, 1);
});

test('rejects a paid quote row without a symbol or usable market data', () => {
    const incomplete = mapQuote({ meta: {}, timestamp: [], indicators: { quote: [{}] } }, options());
    assert.deepEqual(validateQuoteRecord(incomplete), [
        'symbol is missing',
        'price and historical data are both missing',
    ]);
});

test('accepts a complete current quote before billing', () => {
    const record = mapQuote({
        meta: { symbol: 'AAPL', regularMarketPrice: 190, chartPreviousClose: 188 },
        timestamp: [],
        indicators: { quote: [{}] },
    }, options());
    assert.deepEqual(validateQuoteRecord(record), []);
});
