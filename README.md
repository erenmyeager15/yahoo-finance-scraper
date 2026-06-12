# Yahoo Finance Scraper - Stocks, Crypto & Historical Data

Scrape **stock and crypto market data from Yahoo Finance** - no login, no API key required. Get real-time quotes, day and 52-week ranges, volume, exchange info, and full **historical OHLCV** price data for any ticker. Look up symbols by company/asset name. Export to **JSON, CSV, Excel, or HTML**, or pull via the Apify API.

Perfect for **portfolio tracking, quant research, trading bots, dashboards, and market analysis**.

## Features

- ✅ **No login or API key** - uses Yahoo Finance's public chart API
- ✅ **Stocks, crypto, forex, ETFs, indices** - any Yahoo ticker (e.g. `AAPL`, `BTC-USD`, `EURUSD=X`)
- ✅ **Symbol search** - resolve company/asset names to tickers
- ✅ **Live quote** - price, change, day & 52-week high/low, volume, exchange
- ✅ **Historical OHLCV** - open/high/low/close/adjusted-close/volume across many ranges & intervals
- ✅ **Fast & lightweight** - pure JSON, no headless browser

## Input

| Parameter | Type | Description | Default |
|-----------|------|-------------|---------|
| `symbols` | `string[]` | Ticker symbols, e.g. `"AAPL"`, `"BTC-USD"` | `["AAPL"]` |
| `searchQueries` | `string[]` | Names to resolve to tickers (e.g. `"tesla"`) | `[]` |
| `includeHistorical` | `boolean` | Include historical OHLCV in each quote | `false` |
| `historicalRange` | `string` | `1d`/`5d`/`1mo`/`3mo`/`6mo`/`1y`/`2y`/`5y`/`10y`/`ytd`/`max` | `1mo` |
| `historicalInterval` | `string` | `1m`/`5m`/`15m`/`30m`/`60m`/`1d`/`1wk`/`1mo` | `1d` |
| `proxyConfiguration` | `object` | Proxy (helps avoid rate limits on large runs) | Apify Proxy |

### Example input

```json
{
  "symbols": ["AAPL", "MSFT", "BTC-USD"],
  "searchQueries": ["tesla"],
  "includeHistorical": true,
  "historicalRange": "1mo",
  "historicalInterval": "1d"
}
```

## Sample output

```json
{
  "symbol": "AAPL",
  "name": "Apple Inc.",
  "instrumentType": "EQUITY",
  "currency": "USD",
  "exchange": "NasdaqGS",
  "price": 291.58,
  "previousClose": 310.26,
  "change": -18.68,
  "changePercent": -6.02,
  "dayHigh": 294.74,
  "dayLow": 287.38,
  "fiftyTwoWeekHigh": 317.4,
  "fiftyTwoWeekLow": 195.07,
  "volume": 49237715,
  "marketTime": "2026-06-10T20:00:01.000Z",
  "historicalRange": "5d",
  "historicalInterval": "1d",
  "historicalCount": 5,
  "history": [
    { "date": "2026-06-10T13:30:00.000Z", "open": 290.74, "high": 294.74, "low": 287.38, "close": 291.58, "adjClose": 291.58, "volume": 49237715 }
  ],
  "scrapedAt": "2026-06-11T10:00:00.000Z"
}
```

## Pricing

This Actor uses **pay-per-result** pricing:

| Event | Price |
|-------|-------|
| Per quote scraped | **$0.002** ($2 / 1,000 tickers) |

Each ticker is one charge, including its optional historical price series. You are only charged for quotes actually returned. Apify platform usage is billed separately by Apify.

## How to Scrape Yahoo Finance (Step by Step)

1. Click **Try for free** / **Run**.
2. Enter `symbols` (e.g. `AAPL`, `BTC-USD`, `EURUSD=X`), or add `searchQueries` to resolve names to tickers.
3. Toggle `includeHistorical` if you want OHLCV history, then pick a `historicalRange` and `historicalInterval`.
4. Run the Actor (start with a few tickers to test).
5. Export the results as JSON, CSV, Excel, or HTML, or pull them via the Apify API.

## Use cases

- **Portfolio & watchlist tracking** - pull live prices on a schedule
- **Quant research & backtesting** - bulk historical OHLCV across many tickers
- **Dashboards & alerts** - feed prices into BI tools or notifications
- **Crypto + forex monitoring** - `BTC-USD`, `ETH-USD`, `EURUSD=X`, and more

## Tips

- Symbols follow Yahoo's format: crypto as `BTC-USD`, forex as `EURUSD=X`, indices as `^GSPC`.
- Turn on `includeHistorical` and pick a `historicalRange` / `historicalInterval` for time-series data.
- Use `searchQueries` when you know the name but not the exact ticker.

## Responsible Use

This Actor is intended for lawful collection of publicly available information only. Users are responsible for ensuring their use complies with the source website's terms, robots.txt, applicable privacy laws, including India's DPDP Act, and all local regulations.

Do not use this Actor to collect, store, sell, or misuse personal data without a lawful basis. The Actor author is not responsible for misuse by end users.

## License

Apache-2.0
