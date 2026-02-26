/**
 * ============================================================
 * TESTS: src/lib/outliers/index.ts
 * ============================================================
 * Coverage: iqrBounds, excludeOutliers, quartile logic
 *
 * Strategy:
 * - Verify the "Wolf Fence" logic (IQR bounds)
 * - Test small-N behavior (Stage 1 only if < 10)
 * - Test hard thresholding (Stage 1)
 * - Test weighted summaries and reason codes
 * ============================================================
 */

import { describe, it, expect } from 'vitest';
import { excludeOutliers } from '@/lib/outliers/index';
import { PRESETS, REASON_CODES } from '@/lib/outliers/config';
import { CanonicalRow } from '@/lib/data/normalize';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const mkRow = (id: string, spend: number, impressions: number, metricValue?: number): CanonicalRow => ({
    campaignName: id,
    spend,
    impressions,
    clicks: metricValue ? (spend / metricValue) : 0, // Mocking CPC behavior
    videoViews: 0,
    videoViews6s: 0,
    videoViews100pct: 0,
    paidFollowers: 0,
    paidLikes: 0,
    paidComments: 0,
    paidShares: 0,
    formSubmissions: 0
});

const defaultThresholds = PRESETS.Balanced;

// ─── Stage 1: Hard Thresholds ────────────────────────────────────────────────

describe('excludeOutliers – Stage 1 (Hard Thresholds)', () => {
    it('excludes rows below global minSpend', () => {
        const rows = [
            mkRow('A', 5, 10000), // Below Balanced (20)
            mkRow('B', 100, 10000),
        ];
        const { included, excluded, summary } = excludeOutliers(
            rows,
            (r) => r.spend / 100, // Dummy metric
            (r) => r.impressions,
            defaultThresholds
        );

        expect(included).toHaveLength(1);
        expect(excluded).toHaveLength(1);
        expect(excluded[0].reasons).toContain(REASON_CODES.BELOW_MIN_SPEND);
        expect(summary.belowThreshold).toBe(1);
    });

    it('excludes rows below global minImpressions', () => {
        const rows = [
            mkRow('A', 100, 500), // Below Balanced (1000)
            mkRow('B', 100, 5000),
        ];
        const { included, excluded } = excludeOutliers(
            rows,
            (r) => 1,
            (r) => r.impressions,
            defaultThresholds
        );

        expect(included).toHaveLength(1);
        expect(excluded[0].reasons).toContain(REASON_CODES.BELOW_MIN_IMPRESSIONS);
    });

    it('excludes rows below KPI-specific minDenominator', () => {
        const rows = [
            mkRow('A', 100, 5000),
            mkRow('B', 100, 5000),
        ];
        // Row A has 5 clicks, Row B has 50. minDenominator = 10
        rows[0].clicks = 5;
        rows[1].clicks = 50;

        const { included, excluded } = excludeOutliers(
            rows,
            (r) => r.spend / r.clicks,
            (r) => r.clicks,
            defaultThresholds,
            10 // minDenominator
        );

        expect(included).toHaveLength(1);
        expect(excluded[0].reasons).toContain(REASON_CODES.BELOW_MIN_DENOMINATOR);
    });
});

// ─── Stage 2: IQR Detection ──────────────────────────────────────────────────

describe('excludeOutliers – Stage 2 (IQR Outliers)', () => {
    it('does NOT run IQR if less than 10 rows', () => {
        // 9 rows with one extreme outlier
        const rows = Array.from({ length: 9 }, (_, i) => mkRow(`R${i}`, 100, 10000));
        rows[0].clicks = 1; // High CPC outlier
        rows.slice(1).forEach(r => r.clicks = 100);

        const { included, excluded, summary } = excludeOutliers(
            rows,
            (r) => r.spend / r.clicks,
            (r) => r.clicks,
            defaultThresholds
        );

        // Should include all because N < 10
        expect(included).toHaveLength(9);
        expect(summary.iqrOutliers).toBe(0);
    });

    it('detects and excludes outliers when N >= 10', () => {
        // 10 rows: 9 identical, 1 extreme
        const rows = Array.from({ length: 11 }, (_, i) => {
            const r = mkRow(`R${i}`, 100, 10000);
            r.clicks = 100; // CPC = 1
            return r;
        });

        // Add extreme outlier
        rows[10].clicks = 1; // CPC = 100

        const { included, excluded, summary } = excludeOutliers(
            rows,
            (r) => r.spend / r.clicks,
            (r) => r.clicks,
            defaultThresholds
        );

        expect(included).toHaveLength(10);
        expect(excluded).toHaveLength(1);
        expect(excluded[0].reasons).toContain(REASON_CODES.OUTSIDE_IQR_RANGE);
        expect(summary.iqrOutliers).toBe(1);
    });

    it('handles IQR = 0 correctly (no outliers if all values same)', () => {
        const rows = Array.from({ length: 12 }, (_, i) => {
            const r = mkRow(`R${i}`, 100, 10000);
            r.clicks = 100;
            return r;
        });

        const { summary } = excludeOutliers(
            rows,
            (r) => r.spend / r.clicks,
            (r) => r.clicks,
            defaultThresholds
        );

        expect(summary.iqrOutliers).toBe(0);
    });
});

// ─── Summary Logic ───────────────────────────────────────────────────────────

describe('excludeOutliers – Summary Logic', () => {
    it('calculates excluded spend percentage correctly', () => {
        const rows = [
            mkRow('Good', 100, 10000),
            mkRow('Bad', 50, 100), // Should be excluded by minImpressions
        ];

        const { summary } = excludeOutliers(
            rows,
            (r) => 1,
            (r) => r.impressions,
            defaultThresholds
        );

        expect(summary.totalSpend).toBe(150);
        expect(summary.excludedSpend).toBe(50);
    });
});
