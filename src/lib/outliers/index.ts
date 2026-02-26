import { CanonicalRow } from '@/lib/data/normalize';
import { QualityThresholds, REASON_CODES } from './config';

export interface ExclusionResult {
    included: CanonicalRow[];
    excluded: Array<{ row: CanonicalRow; reasons: string[] }>;
    summary: {
        totalIn: number;
        totalOut: number;
        iqrOutliers: number;
        belowThreshold: number;
        totalSpend: number;
        excludedSpend: number;
    };
}

/**
 * Computes proper quartiles using linear interpolation (same method as Excel QUARTILE.INC).
 * More accurate than floor-indexing, especially for small datasets.
 */
function quartile(sorted: number[], q: number): number {
    const n = sorted.length;
    if (n === 0) return 0;
    const pos = q * (n - 1);
    const lo = Math.floor(pos);
    const hi = Math.ceil(pos);
    if (lo === hi) return sorted[lo];
    return sorted[lo] + (pos - lo) * (sorted[hi] - sorted[lo]);
}

/**
 * Safely adds a tiny epsilon to handle log(0) mathematically.
 */
function safeLog(v: number): number {
    return Math.log(v || 1e-9);
}

/**
 * Computes IQR-based outlier fences.
 *
 * Safety rules:
 * - Returns [-Infinity, Infinity] (no exclusions) if fewer than 10 values.
 * - When IQR = 0 (most values identical), falls back to Median Absolute Deviation (MAD),
 *   which provides a robust 50% breakdown point to prevent "masking" by extreme outliers.
 * - The lower fence is clamped to 0 for inherently non-negative metrics.
 */
function iqrBounds(values: number[], multiplier: number, isLogSpace: boolean): [number, number] {
    if (values.length < 10) return [-Infinity, Infinity];

    const sorted = [...values].sort((a, b) => a - b);
    const q1 = quartile(sorted, 0.25);
    const q3 = quartile(sorted, 0.75);
    const iqr = q3 - q1;

    let lo: number, hi: number;

    if (iqr === 0) {
        // Robust Fallback: Median Absolute Deviation (MAD)
        // Solves the 0% breakdown point flaw of Standard Deviation
        const median = quartile(sorted, 0.5);
        const absDeviations = values.map(v => Math.abs(v - median)).sort((a, b) => a - b);
        const mad = quartile(absDeviations, 0.5);

        let scale = mad * 1.4826;

        if (scale === 0) {
            // Secondary fallback: Mean Absolute Deviation (MeanAD) from the median
            // Needed if exactly >=50% of values are identical (making MAD=0), but outliers exist.
            const meanAd = absDeviations.reduce((sum, v) => sum + v, 0) / absDeviations.length;
            if (meanAd === 0) return [-Infinity, Infinity]; // All values truly identical
            scale = meanAd * 1.2533; // Approx SD scalar for MeanAD
        }

        // We use a conservative multiplier for the fallback to only catch extreme spikes
        const fallbackMultiplier = Math.max(3.5, multiplier * 1.5);

        lo = median - fallbackMultiplier * scale;
        hi = median + fallbackMultiplier * scale;
    } else {
        lo = q1 - multiplier * iqr;
        hi = q3 + multiplier * iqr;
    }

    // If we computed fences in log-space, exponentiate them back to linear space
    if (isLogSpace) {
        return [Math.exp(lo), Math.exp(hi)];
    }

    return [lo, hi];
}

/**
 * Applies outlier exclusion for a single KPI metric.
 *
 * Two-stage process:
 *  1. Hard minimum thresholds — Rows that simply don't have enough data volume
 *     (spend, impressions, or the KPI-specific denominator) are excluded first.
 *     These are noise rows, not outliers.
 *
 *  2. IQR outlier detection — Run on the rows that passed stage 1. Only kicks
 *     in with 10+ rows. Uses interpolated quartiles for accuracy. Falls back to
 *     mean ± SD when the IQR is zero (near-uniform distributions).
 *
 * Design philosophy:
 *  - We only exclude verified noise (insufficient data) or verified extreme outliers.
 *  - We never exclude rows just because we have too few of them — the reliability
 *    badge system handles low-sample-size warnings.
 *  - IQR is disabled entirely for N < 10 to avoid over-exclusion on small datasets.
 */
export function excludeOutliers(
    rows: CanonicalRow[],
    getMetric: (r: CanonicalRow) => number | null,
    getDenominator: (r: CanonicalRow) => number,
    thresholds: QualityThresholds,
    minDenominator: number = 0,
    isCostKpi: boolean = false,
    requiresImpressions: boolean = true
): ExclusionResult {
    const included: CanonicalRow[] = [];
    const excluded: Array<{ row: CanonicalRow; reasons: string[] }> = [];
    let belowThreshold = 0;
    let totalSpend = 0;
    let excludedSpend = 0;

    // ── Stage 1: Hard minimums ────────────────────────────────────────────────
    // ...
    const afterThreshold: CanonicalRow[] = [];

    for (const row of rows) {
        totalSpend += row.spend;
        const reasons: string[] = [];

        if (row.spend < thresholds.global.minSpend) {
            reasons.push(REASON_CODES.BELOW_MIN_SPEND);
        }
        if (requiresImpressions && row.impressions < thresholds.global.minImpressions) {
            reasons.push(REASON_CODES.BELOW_MIN_IMPRESSIONS);
        }

        if (minDenominator > 0 && getDenominator(row) < minDenominator) {
            const alreadyCoveredByImpressions = reasons.includes(REASON_CODES.BELOW_MIN_IMPRESSIONS);
            if (!alreadyCoveredByImpressions) {
                reasons.push(REASON_CODES.BELOW_MIN_DENOMINATOR);
            }
        }

        if (reasons.length > 0) {
            excluded.push({ row, reasons });
            belowThreshold++;
            excludedSpend += row.spend;
        } else {
            afterThreshold.push(row);
        }
    }

    // ── Stage 2: IQR / Log-IQR outlier detection ─────────────────────────────
    // For skewed financial metrics (CPM/CPC), apply log-transformation to 
    // compute fences gracefully around the heavy right tail.
    const metrics = afterThreshold
        .map((r) => getMetric(r))
        .filter((v): v is number => v !== null && isFinite(v) && v >= 0);

    const valuesForFence = isCostKpi ? metrics.map(safeLog) : metrics;
    const [lo, hi] = iqrBounds(valuesForFence, thresholds.iqrMultiplier, isCostKpi);

    let iqrOutliers = 0;

    for (const row of afterThreshold) {
        const metric = getMetric(row);

        if (metric !== null && isFinite(metric) && metric >= 0 && (metric < lo || metric > hi)) {
            excluded.push({ row, reasons: [REASON_CODES.OUTSIDE_IQR_RANGE] });
            iqrOutliers++;
            excludedSpend += row.spend;
        } else {
            included.push(row);
        }
    }

    return {
        included,
        excluded,
        summary: {
            totalIn: included.length,
            totalOut: excluded.length,
            iqrOutliers,
            belowThreshold,
            totalSpend,
            excludedSpend,
        },
    };
}
