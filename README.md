# Yahoo Finance Scraper - Stocks, Crypto & Historical Data

Scrape public Yahoo Finance quote data for stocks, ETFs, indices, forex pairs, and crypto tickers. The Actor returns one clean row per ticker with price, previous close, change, day range, 52-week range, volume, currency, exchange, market time, and optional historical OHLCV bars.

Use it for watchlists, dashboards, market research, data enrichment, and scheduled exports. It does not require a login or API key. This Actor provides public market data for research and informational use only; it is not financial advice.

## Quick Start

```json
{
  "symbols": ["AAPL"],
  "searchQueries": [],
  "includeHistorical": false,
  "historicalRange": "1mo",
  "historicalInterval": "1d",
  "proxyConfiguration": {
    "useApifyProxy": false
  }
}
```

This retrieves one quote without historical bars, keeping the first run fast and low-cost.

## Input

| Field | Type | Default | Notes |
| --- | --- | --- | --- |
| `symbols` | string array | `["AAPL"]` | Yahoo ticker symbols such as `AAPL`, `MSFT`, `BTC-USD`, `EURUSD=X`, or `^GSPC`. |
| `searchQueries` | string array | `[]` | Company or asset names to resolve to ticker symbols. |
| `includeHistorical` | boolean | `false` | Include OHLCV bars inside each quote row. |
| `historicalRange` | string | `1mo` | Range used when historical prices are enabled. |
| `historicalInterval` | string | `1d` | Candle interval used when historical prices are enabled. |
| `proxyConfiguration` | object | disabled | Usually not needed for small public API runs. Enable only for larger or repeated runs. |

## Output

Each dataset row is one unique ticker:

| Field | Description |
| --- | --- |
| `symbol`, `name`, `instrumentType` | Ticker and Yahoo Finance metadata. |
| `price`, `previousClose`, `change`, `changePercent` | Current quote and price movement. |
| `dayHigh`, `dayLow` | Intraday range. |
| `fiftyTwoWeekHigh`, `fiftyTwoWeekLow` | 52-week range when available. |
| `volume`, `currency`, `exchange` | Market metadata. |
| `marketTime` | Quote timestamp. |
| `historicalRange`, `historicalInterval`, `historicalCount`, `history` | Optional OHLCV time series details. |
| `scrapedAt` | Actor scrape timestamp. |

## Verified Sample

An existing successful run for `AAPL` returned this row:

```json
{
  "symbol": "AAPL",
  "name": "Apple Inc.",
  "instrumentType": "EQUITY",
  "currency": "USD",
  "exchange": "NasdaqGS",
  "price": 298.01,
  "previousClose": 295.63,
  "change": 2.38,
  "changePercent": 0.81,
  "volume": 85962201,
  "marketTime": "2026-06-18T20:00:01.000Z",
  "historicalCount": 0
}
```

## Pricing

Active pay-per-event pricing:

| Event | Price |
| --- | ---: |
| `quote-scraped` | `$0.002` per ticker quote |
| `apify-actor-start` | `$0.00005` per GB at run start |

Each unique ticker is saved and charged atomically, including optional historical data when enabled. Duplicate symbols from direct input and search results are skipped, and the Actor stops further requests when the user's spending limit is reached.

## Common Workflows

1. Pull a scheduled watchlist for stocks, ETFs, crypto, forex, or indices.
2. Resolve company names through `searchQueries`, then fetch the matching quote rows.
3. Enable historical bars for small ticker sets when you need OHLCV data.
4. Export to CSV, Excel, JSON, HTML, or connect through the Apify API.

## Notes and Limits

- Symbols must follow Yahoo Finance format, for example `BTC-USD`, `EURUSD=X`, or `^GSPC`.
- Market data availability, delay, and coverage follow Yahoo Finance.
- Historical data increases response size and runtime; test with one or two symbols first.
- This Actor is for data extraction and research workflows, not investment recommendations.

## Responsible Use

Use this Actor for lawful collection of publicly available market data. Respect Yahoo Finance terms and any rules that apply to how you store, redistribute, or use exported financial data.

## License

Apache-2.0
