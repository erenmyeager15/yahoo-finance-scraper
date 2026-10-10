export interface ActorInput {
    symbols?: string[];
    searchQueries?: string[];
    includeHistorical?: boolean;
    historicalRange?: string;
    historicalInterval?: string;
    trackChanges?: boolean;
    monitorName?: string;
    observationHistoryLimit?: number;
    priceChangePercentThreshold?: number;
    volumeChangePercentThreshold?: number;
    near52WeekBoundaryPercent?: number;
    proxyConfiguration?: {
        useApifyProxy?: boolean;
        apifyProxyGroups?: string[];
        proxyUrls?: string[];
    };
}

export interface HistoricalBar {
    date: string;
    open: number | null;
    high: number | null;
    low: number | null;
    close: number | null;
    adjClose: number | null;
    volume: number | null;
}

export type MonitoringStatus = 'baseline' | 'updated' | 'unchanged' | 'partial';
export type ChangeSeverity = 'info' | 'low' | 'medium' | 'high';

export interface QuoteObservation {
    checkedAt: string;
    price: number | null;
    volume: number | null;
    marketTime: string | null;
    marketState: string | null;
    fiftyTwoWeekHigh: number | null;
    fiftyTwoWeekLow: number | null;
}

export interface QuoteMonitoringState {
    schemaVersion: 1;
    firstSeenAt: string;
    observationCount: number;
    history: QuoteObservation[];
}

export interface QuoteRecord {
    symbol: string;
    name: string | null;
    instrumentType: string | null;
    currency: string | null;
    exchange: string | null;
    exchangeTimezone: string | null;
    marketState: string | null;
    price: number | null;
    previousClose: number | null;
    change: number | null;
    changePercent: number | null;
    dayHigh: number | null;
    dayLow: number | null;
    fiftyTwoWeekHigh: number | null;
    fiftyTwoWeekLow: number | null;
    volume: number | null;
    marketTime: string | null;
    sourceUrl: string;
    historicalRange: string | null;
    historicalInterval: string | null;
    historicalCount: number;
    sma20: number | null;
    sma50: number | null;
    rsi14: number | null;
    returnVolatilityPercent: number | null;
    maxDrawdownPercent: number | null;
    positionIn52WeekRangePercent: number | null;
    distanceFrom52WeekHighPercent: number | null;
    distanceFrom52WeekLowPercent: number | null;
    history: HistoricalBar[];
    monitorName?: string;
    monitoringStatus?: MonitoringStatus;
    changeSeverity?: ChangeSeverity;
    changeSummary?: string;
    firstSeenAt?: string;
    previousSeenAt?: string | null;
    observationCount?: number;
    previousPrice?: number | null;
    priceDelta?: number | null;
    priceDeltaPercent?: number | null;
    previousVolume?: number | null;
    volumeDelta?: number | null;
    volumeDeltaPercent?: number | null;
    changedFields?: string[];
    changeSignals?: string[];
    scrapedAt: string;
}
