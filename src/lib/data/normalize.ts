import { ColumnMappingMap } from '@/lib/mapping';

export interface CanonicalRow {
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
    if (value === null || value === undefined || value === '') return 0;
    const str = String(value).replace(/[€$£,\s]/g, '').replace(',', '.');
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
