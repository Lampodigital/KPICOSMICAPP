export type OutlierPreset = 'Conservative' | 'Balanced' | 'Strict';

export interface QualityThresholds {
    global: {
        minSpend: number;        // Per-row minimum spend (€) — noise elimination only
        minImpressions: number;  // Per-row minimum impressions — noise elimination only
    };
    kpi: {
        CPC: { minClicks: number };
        CPM: { minImpressions: number };
        CPV6: { minVideoViews6s: number };
        CPA?: { minConversions: number };
        CTR: { minImpressions: number };
        CVR: { minClicks: number };
    };
    iqrMultiplier: number;       // Fence = Q1 - k*IQR, Q3 + k*IQR. Higher = more permissive
    maxExcludedSpendPct: number; // Warning threshold: if more spend is excluded, show alert
}

/**
 * Preset philosophy:
 *
 * Conservative — Low bar for inclusion, wide IQR fence. Keeps as much data as possible.
 *   Use when: dataset is small, or you trust the source data.
 *
 * Balanced — Moderate guardrails. Removes clear noise and extreme outliers only.
 *   Use when: general-purpose analysis. This is the default.
 *
 * Strict — Higher minimums, tighter IQR fence. Best for large, clean datasets.
 *   Use when: you have hundreds of rows and want precise benchmarks.
 *
 * Key design principle: IQR only activates with 10+ post-filter rows.
 * Below that, only hard minimums apply — the reliability badge handles small-N warnings.
 */
export const PRESETS: Record<OutlierPreset, QualityThresholds> = {
    Conservative: {
        global: {
            minSpend: 5,            // Only drop truly empty/test rows
            minImpressions: 500,   // Must have at least some delivery
        },
        kpi: {
            CPC: { minClicks: 5 },
            CPM: { minImpressions: 1000 },
            CPV6: { minVideoViews6s: 50 },
            CPA: { minConversions: 3 },
            CTR: { minImpressions: 1000 },
            CVR: { minClicks: 20 },
        },
        iqrMultiplier: 3.0,         // Very wide — only catches extreme extremes
        maxExcludedSpendPct: 20,
    },
    Balanced: {
        global: {
            minSpend: 20,           // Drop rows with very little budget
            minImpressions: 1000,  // Negligible delivery threshold
        },
        kpi: {
            CPC: { minClicks: 10 },
            CPM: { minImpressions: 3000 },
            CPV6: { minVideoViews6s: 100 },
            CPA: { minConversions: 5 },
            CTR: { minImpressions: 3000 },
            CVR: { minClicks: 30 },
        },
        iqrMultiplier: 2.0,         // Standard — removes clear outliers
        maxExcludedSpendPct: 30,
    },
    Strict: {
        global: {
            minSpend: 50,
            minImpressions: 3000,
        },
        kpi: {
            CPC: { minClicks: 30 },
            CPM: { minImpressions: 10000 },
            CPV6: { minVideoViews6s: 300 },
            CPA: { minConversions: 10 },
            CTR: { minImpressions: 10000 },
            CVR: { minClicks: 100 },
        },
        iqrMultiplier: 1.5,         // Tighter fence, but still ~1.5x standard IQR range
        maxExcludedSpendPct: 40,
    },
};

export const REASON_CODES = {
    BELOW_MIN_SPEND: 'BELOW_MIN_SPEND',
    BELOW_MIN_IMPRESSIONS: 'BELOW_MIN_IMPRESSIONS',
    BELOW_MIN_DENOMINATOR: 'BELOW_MIN_DENOMINATOR',
    OUTSIDE_IQR_RANGE: 'OUTSIDE_IQR_RANGE',
};

export type ReliabilityBadge = 'High' | 'Medium' | 'Low' | 'Unavailable';

export interface BadgeThresholds {
    high: { minRows: number; minSpend: number; maxExcludedPct: number };
    medium: { minRows: number; minSpend: number; maxExcludedPct: number };
}

export const DEFAULT_BADGE_THRESHOLDS: BadgeThresholds = {
    high: { minRows: 30, minSpend: 2000, maxExcludedPct: 25 },
    medium: { minRows: 10, minSpend: 300, maxExcludedPct: 45 },
};
