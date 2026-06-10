export interface ActorInput {
    symbols?: string[];
    searchQueries?: string[];
    includeHistorical?: boolean;
    historicalRange?: string;
    historicalInterval?: string;
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

export interface QuoteRecord {
    symbol: string;
    name: string | null;
    instrumentType: string | null;
    currency: string | null;
    exchange: string | null;
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
    historicalRange: string | null;
    historicalInterval: string | null;
    historicalCount: number;
    history: HistoricalBar[];
    scrapedAt: string;
}
