export type ColumnMappingMap = Record<string, string>; // canonical -> sheetHeader

// Default auto-detect mapping based on COSMIC sheet headers
export const DEFAULT_MAPPING: ColumnMappingMap = {
    client: 'Cliente',
    market: 'Nazione',
    objective: 'Objective',
    sector: 'Sector',
    period: 'Formula month',
    year: 'Year',
    month: 'Month',
    currency: 'Currency',
    spend: 'Cost Cosmic',
    impressions: 'Impression',
    clicks: 'Click',
    reach: 'Reach',
    videoViews: 'Video views',
    videoViews6s: '6-Second Video Views',
    videoViews100pct: 'Video Views at 100%',
    paidFollowers: 'Paid Followers',
    paidLikes: 'Paid Likes',
    paidComments: 'Paid Comments',
    paidShares: 'Paid Shares',
    formSubmissions: 'Total Submit Form',
};

const KEYWORD_MAP: Record<string, string[]> = {
    spend: ['cost cosmic', 'spend', 'costo'],
    impressions: ['impression', 'impressions'],
    clicks: ['click', 'clicks'],
    videoViews: ['video views', 'video view'],
    videoViews6s: ['6-second', '6 second', 'vv6'],
    market: ['nazione', 'market', 'country', 'nation'],
    objective: ['objective', 'obiettivo'],
    sector: ['sector', 'settore'],
};

/**
 * Auto-detect column mapping from an array of raw headers.
 * Falls back to DEFAULT_MAPPING entry if header found, else tries keyword match.
 */
export function autoDetectMapping(headers: string[]): ColumnMappingMap {
    const result: ColumnMappingMap = { ...DEFAULT_MAPPING };

    for (const [canonical, keywords] of Object.entries(KEYWORD_MAP)) {
        const found = headers.find((h) =>
            keywords.some((kw) => h.toLowerCase().includes(kw))
        );
        if (found) result[canonical] = found;
    }

    return result;
}
