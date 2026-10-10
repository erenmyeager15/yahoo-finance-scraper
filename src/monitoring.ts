import { createHash } from 'node:crypto';
import type {
    ChangeSeverity,
    MonitoringStatus,
    QuoteMonitoringState,
    QuoteObservation,
    QuoteRecord,
} from './types.js';

function hash(value: string): string {
    return createHash('sha256').update(value).digest('hex');
}

export function monitoringStoreName(monitorName: string): string {
    return `yahoo-market-monitor-${hash(monitorName.trim().toLowerCase()).slice(0, 24)}`;
}

export function monitoringRecordKey(symbol: string): string {
    return `QUOTE_${hash(symbol.trim().toUpperCase()).slice(0, 40)}`;
}

function round(value: number, digits = 4): number {
    const factor = 10 ** digits;
    return Math.round(value * factor) / factor;
}

function percentDelta(current: number | null, previous: number | null): number | null {
    if (current === null || previous === null || previous === 0) return null;
    return round(((current - previous) / Math.abs(previous)) * 100);
}

function observationFor(record: QuoteRecord): QuoteObservation {
    return {
        checkedAt: record.scrapedAt,
        price: record.price,
        volume: record.volume,
        marketTime: record.marketTime,
        marketState: record.marketState,
        fiftyTwoWeekHigh: record.fiftyTwoWeekHigh,
        fiftyTwoWeekLow: record.fiftyTwoWeekLow,
    };
}

function retainedObservation(current: QuoteObservation, previous: QuoteObservation | null): QuoteObservation {
    if (!previous) return current;
    return {
        ...current,
        price: current.price ?? previous.price,
        volume: current.volume ?? previous.volume,
        marketTime: current.marketTime ?? previous.marketTime,
        marketState: current.marketState ?? previous.marketState,
        fiftyTwoWeekHigh: current.fiftyTwoWeekHigh ?? previous.fiftyTwoWeekHigh,
        fiftyTwoWeekLow: current.fiftyTwoWeekLow ?? previous.fiftyTwoWeekLow,
    };
}

function severityFor(status: MonitoringStatus, priceDeltaPercent: number | null, threshold: number): ChangeSeverity {
    if (status === 'baseline' || status === 'unchanged') return 'info';
    if (status === 'partial') return 'low';
    if (priceDeltaPercent !== null && Math.abs(priceDeltaPercent) >= Math.max(5, threshold * 2)) return 'high';
    return 'medium';
}

export interface MonitoringOptions {
    monitorName: string;
    historyLimit: number;
    priceChangePercentThreshold: number;
    volumeChangePercentThreshold: number;
    near52WeekBoundaryPercent: number;
}

export interface MonitoringResult {
    record: QuoteRecord;
    nextState: QuoteMonitoringState;
}

export function applyMonitoring(
    record: QuoteRecord,
    previousState: QuoteMonitoringState | null,
    options: MonitoringOptions,
): MonitoringResult {
    const rawCurrent = observationFor(record);
    const previous = previousState?.history.at(-1) ?? null;
    const retained = retainedObservation(rawCurrent, previous);
    const changedFields: string[] = [];
    const changeSignals: string[] = [];
    const priceDelta = rawCurrent.price !== null && previous?.price != null
        ? round(rawCurrent.price - previous.price)
        : null;
    const priceDeltaPercent = percentDelta(rawCurrent.price, previous?.price ?? null);
    const volumeDelta = rawCurrent.volume !== null && previous?.volume != null
        ? rawCurrent.volume - previous.volume
        : null;
    const volumeDeltaPercent = percentDelta(rawCurrent.volume, previous?.volume ?? null);

    if (previous) {
        if (priceDeltaPercent !== null && Math.abs(priceDeltaPercent) >= options.priceChangePercentThreshold) {
            changedFields.push('price');
            changeSignals.push(priceDeltaPercent > 0 ? 'price_increased' : 'price_decreased');
            changeSignals.push('price_threshold_crossed');
        }
        if (volumeDeltaPercent !== null && Math.abs(volumeDeltaPercent) >= options.volumeChangePercentThreshold) {
            changedFields.push('volume');
            changeSignals.push(volumeDeltaPercent > 0 ? 'volume_increased' : 'volume_decreased');
            changeSignals.push('volume_threshold_crossed');
        }
        if (rawCurrent.fiftyTwoWeekHigh !== null && rawCurrent.fiftyTwoWeekHigh !== previous.fiftyTwoWeekHigh) {
            changedFields.push('fiftyTwoWeekHigh');
            changeSignals.push('new_52_week_high_reference');
        }
        if (rawCurrent.fiftyTwoWeekLow !== null && rawCurrent.fiftyTwoWeekLow !== previous.fiftyTwoWeekLow) {
            changedFields.push('fiftyTwoWeekLow');
            changeSignals.push('new_52_week_low_reference');
        }
        if (rawCurrent.marketState !== null && rawCurrent.marketState !== previous.marketState) {
            changedFields.push('marketState');
            changeSignals.push('market_state_changed');
        }
    }

    if (record.distanceFrom52WeekHighPercent !== null
        && Math.abs(record.distanceFrom52WeekHighPercent) <= options.near52WeekBoundaryPercent) {
        changeSignals.push('near_52_week_high');
    }
    if (record.distanceFrom52WeekLowPercent !== null
        && Math.abs(record.distanceFrom52WeekLowPercent) <= options.near52WeekBoundaryPercent) {
        changeSignals.push('near_52_week_low');
    }

    const incomplete = Boolean(previous?.price !== null && rawCurrent.price === null);
    const status: MonitoringStatus = !previous
        ? 'baseline'
        : incomplete
            ? 'partial'
            : changedFields.length > 0
                ? 'updated'
                : 'unchanged';
    const firstSeenAt = previousState?.firstSeenAt ?? record.scrapedAt;
    const observationCount = (previousState?.observationCount ?? 0) + 1;
    const severity = severityFor(status, priceDeltaPercent, options.priceChangePercentThreshold);
    const summary = status === 'baseline'
        ? 'First observation saved for this watchlist.'
        : status === 'unchanged'
            ? 'No configured price, volume, market-state, or 52-week threshold changed.'
            : status === 'partial'
                ? 'The current response omitted a previously available price; the last complete value remains only in private history.'
                : `Changed: ${changedFields.join(', ')}. Signals: ${changeSignals.join(', ')}.`;

    return {
        record: {
            ...record,
            monitorName: options.monitorName,
            monitoringStatus: status,
            changeSeverity: severity,
            changeSummary: summary,
            firstSeenAt,
            previousSeenAt: previous?.checkedAt ?? null,
            observationCount,
            previousPrice: previous?.price ?? null,
            priceDelta,
            priceDeltaPercent,
            previousVolume: previous?.volume ?? null,
            volumeDelta,
            volumeDeltaPercent,
            changedFields,
            changeSignals: [...new Set(changeSignals)],
        },
        nextState: {
            schemaVersion: 1,
            firstSeenAt,
            observationCount,
            history: [...(previousState?.history ?? []), retained].slice(-options.historyLimit),
        },
    };
}
