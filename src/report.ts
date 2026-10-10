import type { QuoteRecord } from './types.js';

function csvCell(value: unknown): string {
    let normalized = value === null || value === undefined ? '' : String(value);
    if (typeof value === 'string' && /^[\t\r ]*[=+\-@]/.test(normalized)) normalized = `'${normalized}`;
    return `"${normalized.replace(/"/g, '""')}"`;
}

function markdownCell(value: unknown): string {
    return String(value ?? '').replace(/\s+/g, ' ').replace(/\|/g, '\\|').trim();
}

export function buildChangeReport(records: QuoteRecord[], monitorName: string): string {
    const statusCount = (status: string) => records.filter((record) => record.monitoringStatus === status).length;
    const lines = [
        '# US market watchlist change report',
        '',
        `Watchlist: **${monitorName.replace(/\*/g, '\\*')}**`,
        '',
        `Quotes: **${records.length}** | Updated: **${statusCount('updated')}** | Baseline: **${statusCount('baseline')}** | Unchanged: **${statusCount('unchanged')}** | Partial: **${statusCount('partial')}**`,
        '',
        '| Symbol | Status | Severity | Price | Price delta % | Volume delta % | 52W position % | Signals | Source |',
        '|---|---|---|---:|---:|---:|---:|---|---|',
    ];
    for (const record of records) {
        lines.push(`| ${markdownCell(record.symbol)} | ${markdownCell(record.monitoringStatus)} | ${markdownCell(record.changeSeverity)} | ${markdownCell(record.price)} | ${markdownCell(record.priceDeltaPercent)} | ${markdownCell(record.volumeDeltaPercent)} | ${markdownCell(record.positionIn52WeekRangePercent)} | ${markdownCell(record.changeSignals?.join(', '))} | ${markdownCell(record.sourceUrl)} |`);
    }
    lines.push('', '_Calculated signals are descriptive thresholds, not investment advice or trading recommendations._', '');
    return lines.join('\n');
}

export function buildChangeCsv(records: QuoteRecord[]): string {
    const fields: Array<keyof QuoteRecord> = [
        'monitorName', 'symbol', 'name', 'monitoringStatus', 'changeSeverity', 'price', 'previousPrice',
        'priceDelta', 'priceDeltaPercent', 'volume', 'previousVolume', 'volumeDelta', 'volumeDeltaPercent',
        'positionIn52WeekRangePercent', 'distanceFrom52WeekHighPercent', 'distanceFrom52WeekLowPercent',
        'sma20', 'sma50', 'rsi14', 'returnVolatilityPercent', 'maxDrawdownPercent', 'marketState',
        'marketTime', 'sourceUrl', 'scrapedAt',
    ];
    const header = [...fields, 'changedFields', 'changeSignals'];
    const rows = records.map((record) => [
        ...fields.map((field) => record[field]),
        record.changedFields?.join('|') ?? '',
        record.changeSignals?.join('|') ?? '',
    ].map(csvCell).join(','));
    return [header.map(csvCell).join(','), ...rows].join('\r\n');
}
