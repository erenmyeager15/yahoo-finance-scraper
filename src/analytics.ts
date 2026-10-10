import type { HistoricalBar, QuoteRecord } from './types.js';

function round(value: number, digits = 4): number {
    const factor = 10 ** digits;
    return Math.round(value * factor) / factor;
}

function closes(history: HistoricalBar[]): number[] {
    return history.map((bar) => bar.close).filter((value): value is number => value !== null);
}

export function simpleMovingAverage(values: number[], period: number): number | null {
    if (values.length < period) return null;
    const sample = values.slice(-period);
    return round(sample.reduce((sum, value) => sum + value, 0) / sample.length);
}

export function relativeStrengthIndex(values: number[], period = 14): number | null {
    if (values.length < period + 1) return null;
    const sample = values.slice(-(period + 1));
    let gains = 0;
    let losses = 0;
    for (let index = 1; index < sample.length; index += 1) {
        const delta = sample[index] - sample[index - 1];
        if (delta >= 0) gains += delta;
        else losses -= delta;
    }
    const averageGain = gains / period;
    const averageLoss = losses / period;
    if (averageLoss === 0) return averageGain === 0 ? 50 : 100;
    const rs = averageGain / averageLoss;
    return round(100 - (100 / (1 + rs)), 2);
}

export function returnVolatility(values: number[]): number | null {
    if (values.length < 3) return null;
    const returns: number[] = [];
    for (let index = 1; index < values.length; index += 1) {
        if (values[index - 1] === 0) continue;
        returns.push((values[index] - values[index - 1]) / values[index - 1]);
    }
    if (returns.length < 2) return null;
    const mean = returns.reduce((sum, value) => sum + value, 0) / returns.length;
    const variance = returns.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / (returns.length - 1);
    return round(Math.sqrt(variance) * 100, 4);
}

export function maxDrawdown(values: number[]): number | null {
    if (values.length < 2) return null;
    let peak = values[0];
    let worst = 0;
    for (const value of values) {
        peak = Math.max(peak, value);
        if (peak > 0) worst = Math.min(worst, ((value - peak) / peak) * 100);
    }
    return round(worst, 4);
}

function percentDistance(value: number | null, boundary: number | null, denominator: number | null): number | null {
    if (value === null || boundary === null || denominator === null || denominator === 0) return null;
    return round(((value - boundary) / denominator) * 100, 4);
}

export function addAnalytics(record: QuoteRecord): QuoteRecord {
    const values = closes(record.history);
    const low = record.fiftyTwoWeekLow;
    const high = record.fiftyTwoWeekHigh;
    const range = low !== null && high !== null ? high - low : null;
    const position = record.price !== null && low !== null && range !== null && range > 0
        ? round(((record.price - low) / range) * 100, 2)
        : null;

    return {
        ...record,
        sma20: simpleMovingAverage(values, 20),
        sma50: simpleMovingAverage(values, 50),
        rsi14: relativeStrengthIndex(values),
        returnVolatilityPercent: returnVolatility(values),
        maxDrawdownPercent: maxDrawdown(values),
        positionIn52WeekRangePercent: position,
        distanceFrom52WeekHighPercent: percentDistance(record.price, high, high),
        distanceFrom52WeekLowPercent: percentDistance(record.price, low, low),
    };
}
