# Yahoo Finance Market Monitor - Stocks, ETFs & Crypto

Turn public Yahoo Finance quotes into a repeatable market watchlist. The Actor returns current data for US and global stocks, ETFs, indices, forex pairs, and crypto, then compares each scheduled run with the previous private observation.

Use it for market dashboards, watchlist exports, price and volume change signals, research pipelines, and scheduled monitoring. No login, API key, or proxy is required for the default workflow.

> Calculated fields and threshold signals are descriptive data, not investment advice, forecasts, or buy/sell recommendations.

## What makes this different

- **Repeat-run monitoring:** every row is labeled `baseline`, `updated`, `unchanged`, or `partial`.
- **Configurable thresholds:** detect observed price and volume changes without post-processing.
- **Bounded private history:** retain 2-50 observations per ticker under a named watchlist.
- **Ready-to-use reports:** each monitored run produces `CHANGE_REPORT` (Markdown), `CHANGE_REPORT_CSV`, and `RUN_SUMMARY` records.
- **52-week context:** position inside the reported range plus distance from its high and low.
- **Optional technical calculations:** SMA 20, SMA 50, RSI 14, observed-return volatility, and maximum drawdown from requested OHLCV bars.
- **Current rows stay complete:** a missing current field does not silently erase the last complete value in private history.
- **Low operating cost:** HTTP-only collection, no proxy by default, and a 256 MB default memory profile.

## Quick start

```json
{
  "symbols": ["AAPL", "MSFT", "NVDA", "SPY", "QQQ"],
  "includeHistorical": true,
  "historicalRange": "3mo",
  "historicalInterval": "1d",
  "trackChanges": true,
  "monitorName": "us-market-watchlist",
  "priceChangePercentThreshold": 2,
  "volumeChangePercentThreshold": 50,
  "near52WeekBoundaryPercent": 2,
  "proxyConfiguration": {
    "useApifyProxy": false
  }
}
```

Run the same input on a schedule. The first run creates a baseline; later runs show observed deltas and configured signals.

## Input

| Field | Default | Purpose |
| --- | --- | --- |
| `symbols` | `["AAPL"]` | Up to 250 Yahoo ticker symbols such as `AAPL`, `SPY`, `BTC-USD`, `EURUSD=X`, or `^GSPC`. |
| `searchQueries` | `[]` | Resolve up to 50 company or asset names to matching ticker symbols. |
| `includeHistorical` | `false` | Include OHLCV bars and calculate history-based analytics. |
| `historicalRange` | `1mo` | Yahoo history range. Use at least `3mo` with daily bars for SMA 50. |
| `historicalInterval` | `1d` | Candle interval. |
| `trackChanges` | `true` | Compare with the previous private observation and create reports. |
| `monitorName` | `us-market-watchlist` | Stable private watchlist identity. Reuse it across scheduled runs. |
| `observationHistoryLimit` | `10` | Bounded private observations retained per ticker (2-50). |
| `priceChangePercentThreshold` | `2` | Minimum observed price movement that marks a row updated. |
| `volumeChangePercentThreshold` | `50` | Minimum observed volume movement that marks a row updated. |
| `near52WeekBoundaryPercent` | `2` | Distance that triggers a near-high or near-low descriptive signal. |
| `proxyConfiguration` | disabled | Optional for unusually large or rate-limited runs. |

## Dataset output

Every saved item is a current quote row. Monitoring adds comparison fields but never replaces the current source value.

| Group | Fields |
| --- | --- |
| Identity | `symbol`, `name`, `instrumentType`, `sourceUrl` |
| Current quote | `price`, `previousClose`, `change`, `changePercent`, `dayHigh`, `dayLow`, `volume` |
| Market context | `currency`, `exchange`, `exchangeTimezone`, `marketState`, `marketTime` |
| 52-week context | `fiftyTwoWeekHigh`, `fiftyTwoWeekLow`, `positionIn52WeekRangePercent`, `distanceFrom52WeekHighPercent`, `distanceFrom52WeekLowPercent` |
| Repeat monitoring | `monitoringStatus`, `changeSeverity`, `previousPrice`, `priceDelta`, `priceDeltaPercent`, `previousVolume`, `volumeDelta`, `volumeDeltaPercent`, `changedFields`, `changeSignals` |
| Calculated history | `sma20`, `sma50`, `rsi14`, `returnVolatilityPercent`, `maxDrawdownPercent` |
| OHLCV | `historicalRange`, `historicalInterval`, `historicalCount`, `history` |

History-based metrics remain `null` when the requested series does not contain enough valid closes. The Actor does not invent missing calculations.

## Monitoring behavior

- `baseline`: first saved observation for the ticker and watchlist.
- `updated`: a configured price/volume threshold, market state, or reported 52-week boundary changed.
- `unchanged`: no configured comparison condition changed.
- `partial`: the current response omitted a price that was present previously; the last complete value is retained only in private history.

Private state is updated only after the current dataset row is saved. A failed save cannot advance the comparison history.

## Key-value store outputs

- `RUN_SUMMARY`: saved count, request failures, empty source responses, charge-limit status, monitoring counts, and history read/write failures.
- `CHANGE_REPORT`: readable Markdown watchlist report.
- `CHANGE_REPORT_CSV`: flat comparison export for spreadsheets and alerts.

## Pricing

| Event | Price |
| --- | ---: |
| `quote-scraped` | `$0.002` per saved ticker quote |
| `apify-actor-start` | `$0.00005` per GB at run start |

Monitoring fields, reports, direct source links, and optional historical analytics are included in the quote event. Duplicate symbols are skipped, and collection stops when the user's event-charge limit is reached.

## Reliability and limits

- The default input is one `AAPL` quote, designed to finish well inside Apify's automated-test window.
- A run that saves no quote now fails with a clear count of request failures and empty Yahoo responses instead of appearing successful with zero results.
- If optional historical data is unavailable, the Actor falls back to the current quote instead of losing the ticker. The fallback is counted in `RUN_SUMMARY`.
- Invalid or incomplete rows are rejected before they can be saved or billed.
- Availability, delay, coverage, and corrections follow Yahoo Finance.
- Symbols must use Yahoo Finance notation.
- Intraday intervals have provider-specific historical range limits.
- Search can return several related listings; output is deduplicated by symbol.

## Responsible use

Use this Actor for lawful collection of publicly available market data. Review Yahoo's terms and any market-data licensing rules that apply to storage, redistribution, or commercial use. Validate important decisions against an authorized market-data source.

## License

Apache-2.0
