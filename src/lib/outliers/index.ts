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
 * Computes IQR-based outlier fences.
 *
 * Safety rules:
 * - Returns [-Infinity, Infinity] (no exclusions) if fewer than 10 values.
 *   IQR on small datasets produces unreliable fences.
 *
 * - When IQR = 0 (most values identical), falls back to mean ± k * stdDev
 *   to catch true extreme outliers while keeping near-identical values.
 *   If stdDev is also 0 (all values truly identical), no exclusions.
 *
 * - The lower fence is clamped to 0 for inherently non-negative metrics.
 */
function iqrBounds(values: number[], multiplier: number): [number, number] {
    if (values.length < 10) return [-Infinity, Infinity];

    const sorted = [...values].sort((a, b) => a - b);
    const q1 = quartile(sorted, 0.25);
    const q3 = quartile(sorted, 0.75);
    const iqr = q3 - q1;

    if (iqr === 0) {
        // All values are at the same quartile range — use std deviation fallback
        const mean = values.reduce((s, v) => s + v, 0) / values.length;
        const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
        const std = Math.sqrt(variance);

        // If std is also 0, all values are truly identical — nothing is an outlier
        if (std === 0) return [-Infinity, Infinity];

        // Use 3 SD fence (very conservative, only catches extreme deviations)
        // Scale the multiplier slightly: a 3.0× IQR user who gets this fallback
        // should still see moderate exclusions, so map multiplier → SD factor.
        const sdFactor = Math.max(3, multiplier * 1.5);
        return [mean - sdFactor * std, mean + sdFactor * std];
    }

    return [q1 - multiplier * iqr, q3 + multiplier * iqr];
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
    minDenominator: number = 0
): ExclusionResult {
    const included: CanonicalRow[] = [];
    const excluded: Array<{ row: CanonicalRow; reasons: string[] }> = [];
    let belowThreshold = 0;
    let totalSpend = 0;
    let excludedSpend = 0;

    // ── Stage 1: Hard minimums ────────────────────────────────────────────────
    // These are noise/quality filters — rows that simply don't have enough
    // budget or delivery to contribute a reliable signal.
    const afterThreshold: CanonicalRow[] = [];

    for (const row of rows) {
        totalSpend += row.spend;
        const reasons: string[] = [];

        if (row.spend < thresholds.global.minSpend) {
            reasons.push(REASON_CODES.BELOW_MIN_SPEND);
        }
        if (row.impressions < thresholds.global.minImpressions) {
            reasons.push(REASON_CODES.BELOW_MIN_IMPRESSIONS);
        }

        // KPI-specific denominator check — only flag if it's a distinct reason
        // (avoid duplicating the impression check for CPM/CTR)
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

    // ── Stage 2: IQR outlier detection ───────────────────────────────────────
    // Only runs on rows that passed Stage 1.
    // Requires at least 10 data points to produce meaningful outlier bounds.
    const metrics = afterThreshold
        .map((r) => getMetric(r))
        .filter((v): v is number => v !== null && isFinite(v) && v >= 0);

    const [lo, hi] = iqrBounds(metrics, thresholds.iqrMultiplier);
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
