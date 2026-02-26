import { ColumnMappingMap } from '@/lib/mapping';

export interface CanonicalRow {
    campaignName?: string;
    client?: string;
    market?: string;
    objective?: string;
    sector?: string;
    period?: string;
    year?: number;
    month?: number;
    currency?: string;
    spend: number;
    impressions: number;
    clicks: number;
    reach: number;
    videoViews: number;
    videoViews6s: number;
    videoViews100pct: number;
    paidFollowers: number;
    paidLikes: number;
    paidComments: number;
    paidShares: number;
    formSubmissions: number;
}

function parseNum(value: unknown): number {
    if (typeof value === 'number') return value;
    if (value === null || value === undefined || value === '') return 0;

    let str = String(value).trim();
    // Remove currency symbols and non-essential characters, keep digits, dots, and commas
    str = str.replace(/[€$£\s]/g, '');

    const lastComma = str.lastIndexOf(',');
    const lastDot = str.lastIndexOf('.');

    if (lastComma > -1 && lastDot > -1) {
        // Both exist. The one occurring last is the decimal.
        if (lastComma > lastDot) {
            // Comma is decimal. Remove dots (thousands).
            str = str.replace(/\./g, '').replace(',', '.');
        } else {
            // Dot is decimal. Remove commas (thousands).
            str = str.replace(/,/g, '');
        }
    } else if (lastComma > -1) {
        // Only comma exists. 
        const commaCount = (str.match(/,/g) || []).length;
        if (commaCount > 1) {
            // Multiple commas -> thousands. Remove them.
            str = str.replace(/,/g, '');
        } else {
            // Single comma. In European Excel exports, this is almost always a decimal.
            str = str.replace(',', '.');
        }
    } else if (lastDot > -1) {
        // Only dot exists.
        const dotCount = (str.match(/\./g) || []).length;
        if (dotCount > 1) {
            // Multiple dots -> thousands.
            str = str.replace(/\./g, '');
        } else {
            // Single dot. standard decimal for parseFloat.
        }
    }

    const n = parseFloat(str);
    return isNaN(n) ? 0 : n;
}

function parseStr(value: unknown): string {
    if (value === null || value === undefined) return '';
    return String(value).trim();
}

export function normalizeRow(
    raw: Record<string, unknown>,
    mapping: ColumnMappingMap
): CanonicalRow | null {
    const get = (canonical: string): unknown => {
        const header = mapping[canonical];
        if (!header) return null;
        return raw[header] ?? null;
    };

    const spend = parseNum(get('spend'));
    const impressions = parseNum(get('impressions'));

    // Require at minimum some spend or impressions to be useful
    if (spend === 0 && impressions === 0) return null;

    return {
        campaignName: parseStr(get('campaignName')) || undefined,
        client: parseStr(get('client')) || undefined,
        market: parseStr(get('market')) || undefined,
        objective: parseStr(get('objective')) || undefined,
        sector: parseStr(get('sector')) || undefined,
        period: parseStr(get('period')) || undefined,
        year: get('year') ? Number(get('year')) : undefined,
        month: get('month') ? Number(get('month')) : undefined,
        currency: parseStr(get('currency')) || 'EUR',
        spend,
        impressions,
        clicks: parseNum(get('clicks')),
        reach: parseNum(get('reach')),
        videoViews: parseNum(get('videoViews')),
        videoViews6s: parseNum(get('videoViews6s')),
        videoViews100pct: parseNum(get('videoViews100pct')),
        paidFollowers: parseNum(get('paidFollowers')),
        paidLikes: parseNum(get('paidLikes')),
        paidComments: parseNum(get('paidComments')),
        paidShares: parseNum(get('paidShares')),
        formSubmissions: parseNum(get('formSubmissions')),
    };
}
