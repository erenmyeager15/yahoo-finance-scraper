import assert from 'node:assert/strict';
import test from 'node:test';
import { applyMonitoring, monitoringRecordKey, monitoringStoreName } from './monitoring.js';
import type { QuoteMonitoringState, QuoteRecord } from './types.js';

function quote(overrides: Partial<QuoteRecord> = {}): QuoteRecord {
    return {
        symbol: 'AAPL', name: 'Apple Inc.', instrumentType: 'EQUITY', currency: 'USD', exchange: 'NasdaqGS',
        exchangeTimezone: 'America/New_York', marketState: 'REGULAR', price: 100, previousClose: 99,
        change: 1, changePercent: 1.01, dayHigh: 101, dayLow: 98, fiftyTwoWeekHigh: 102,
        fiftyTwoWeekLow: 50, volume: 1000, marketTime: '2026-01-01T20:00:00.000Z',
        sourceUrl: 'https://finance.yahoo.com/quote/AAPL', historicalRange: null, historicalInterval: null,
        historicalCount: 0, sma20: null, sma50: null, rsi14: null, returnVolatilityPercent: null,
        maxDrawdownPercent: null, positionIn52WeekRangePercent: 96.15, distanceFrom52WeekHighPercent: -1.96,
        distanceFrom52WeekLowPercent: 100, history: [], scrapedAt: '2026-01-01T20:01:00.000Z',
        ...overrides,
    };
}

const options = {
    monitorName: 'US Tech',
    historyLimit: 2,
    priceChangePercentThreshold: 2,
    volumeChangePercentThreshold: 50,
    near52WeekBoundaryPercent: 2,
};

test('uses stable private store and record identifiers', () => {
    assert.match(monitoringStoreName('US Tech'), /^yahoo-market-monitor-[a-f0-9]{24}$/);
    assert.equal(monitoringStoreName('US Tech'), monitoringStoreName('us tech'));
    assert.equal(monitoringRecordKey('aapl'), monitoringRecordKey('AAPL'));
});

test('creates a baseline and preserves bounded history', () => {
    const baseline = applyMonitoring(quote(), null, options);
    assert.equal(baseline.record.monitoringStatus, 'baseline');
    assert.deepEqual(baseline.record.changeSignals, ['near_52_week_high']);
    assert.equal(baseline.nextState.history.length, 1);

    const repeat = applyMonitoring(quote({ scrapedAt: '2026-01-02T20:01:00.000Z' }), baseline.nextState, options);
    assert.equal(repeat.record.monitoringStatus, 'unchanged');
    assert.equal(repeat.nextState.history.length, 2);

    const third = applyMonitoring(quote({ scrapedAt: '2026-01-03T20:01:00.000Z' }), repeat.nextState, options);
    assert.equal(third.nextState.history.length, 2);
    assert.equal(third.record.observationCount, 3);
});

test('flags configured price and volume changes', () => {
    const baseline = applyMonitoring(quote(), null, options);
    const changed = applyMonitoring(quote({ price: 106, volume: 2000 }), baseline.nextState, options);
    assert.equal(changed.record.monitoringStatus, 'updated');
    assert.equal(changed.record.priceDeltaPercent, 6);
    assert.equal(changed.record.volumeDeltaPercent, 100);
    assert.ok(changed.record.changeSignals?.includes('price_threshold_crossed'));
    assert.ok(changed.record.changeSignals?.includes('volume_threshold_crossed'));
    assert.equal(changed.record.changeSeverity, 'high');
});

test('does not erase a prior complete price when a response is partial', () => {
    const baseline = applyMonitoring(quote(), null, options);
    const partial = applyMonitoring(quote({ price: null }), baseline.nextState, options);
    assert.equal(partial.record.monitoringStatus, 'partial');
    assert.equal(partial.nextState.history.at(-1)?.price, 100);
});

test('calculates thresholds against the last retained observation', () => {
    const state: QuoteMonitoringState = {
        schemaVersion: 1,
        firstSeenAt: '2026-01-01T20:01:00.000Z',
        observationCount: 2,
        history: [{
            checkedAt: '2026-01-02T20:01:00.000Z', price: 100, volume: 1000,
            marketTime: null, marketState: 'CLOSED', fiftyTwoWeekHigh: 102, fiftyTwoWeekLow: 50,
        }],
    };
    const below = applyMonitoring(quote({ price: 101.99, volume: 1499, marketState: 'CLOSED' }), state, options);
    assert.equal(below.record.monitoringStatus, 'unchanged');
});
