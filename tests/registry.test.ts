/**
 * ============================================================
 * TESTS: src/lib/kpis/registry.ts
 * ============================================================
 * Coverage: computeKPIs, computeKpi, reliability badge logic,
 *           margin application.
 *
 * Strategy:
 * - Verify different reliability levels (High, Medium, Low, Unavailable)
 * - Test margin logic only applies to cost KPIs
 * - Test preset application
 * ============================================================
 */

import { describe, it, expect } from 'vitest';
import { computeKPIs } from '@/lib/kpis/registry';
import { CanonicalRow } from '@/lib/data/normalize';
import { DEFAULT_BADGE_THRESHOLDS } from '@/lib/outliers/config';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const mkRow = (spend: number, impressions: number, clicks = 0): CanonicalRow => ({
    spend,
    impressions,
    clicks,
    videoViews: 0,
    videoViews6s: 0,
    videoViews100pct: 0,
    paidFollowers: 0,
    paidLikes: 0,
    paidComments: 0,
    paidShares: 0,
    formSubmissions: 0
} as CanonicalRow);

const defaultOptions = {
    marginPct: 0,
    preset: 'Balanced' as const
};

// ─── Reliability Badge Logic ───────────────────────────────────────────────

describe('KPI Registry – Reliability Badges', () => {
    it('assigns "High" reliability when thresholds met', () => {
        // High: 30+ rows, 2000+ spend, < 25% excluded.
        const rows = Array.from({ length: 40 }, () => mkRow(100, 10000, 500));
        const result = computeKPIs(rows, defaultOptions);

        expect(result.CPM?.reliability).toBe('High');
    });

    it('assigns "Medium" reliability when high criteria not met but medium is', () => {
        // Medium: 10+ rows, 300+ spend, < 45% excluded.
        const rows = Array.from({ length: 15 }, () => mkRow(50, 5000, 100));
        const result = computeKPIs(rows, defaultOptions);

        expect(result.CPM?.reliability).toBe('Medium');
    });

    it('assigns "Low" reliability when below medium criteria', () => {
        const rows = Array.from({ length: 5 }, () => mkRow(50, 5000));
        const result = computeKPIs(rows, defaultOptions);

        expect(result.CPM?.reliability).toBe('Low');
    });

    it('assigns "Unavailable" when data is extremely sparse', () => {
        // CPM minImpressions for Balanced is 3000
        const rows = [mkRow(100, 500)];
        const result = computeKPIs(rows, defaultOptions);
        expect(result.CPM?.raw).toBeNull();
        expect(result.CPM?.reliability).toBe('Unavailable');
    });
});

// ─── Margin Adjustment ───────────────────────────────────────────────────────

describe('KPI Registry – Margin Adjustment', () => {
    it('applies margin correctly to cost KPIs (CPM, CPC)', () => {
        const rows = [mkRow(100, 10000, 100)]; // CPM = 10, CPC = 1
        const result = computeKPIs(rows, { ...defaultOptions, marginPct: 20 });

        // Margin formula: value / (1 - margin/100)
        // 10 / 0.8 = 12.5
        // 1 / 0.8 = 1.25
        expect(result.CPM?.adjusted).toBeCloseTo(12.5);
        expect(result.CPC?.adjusted).toBeCloseTo(1.25);
    });

    it('does NOT apply margin to ratio KPIs (CTR)', () => {
        const rows = [mkRow(100, 10000, 100)]; // CTR = 1% (0.01)
        const result = computeKPIs(rows, { ...defaultOptions, marginPct: 20 });

        expect(result.CTR?.adjusted).toBe(result.CTR?.raw);
        expect(result.CTR?.raw).toBe(0.01);
    });

    it('handles 0% margin', () => {
        const rows = [mkRow(100, 10000, 100)];
        const result = computeKPIs(rows, { ...defaultOptions, marginPct: 0 });
        expect(result.CPM?.adjusted).toBe(result.CPM?.raw);
    });
});

// ─── Preset Application ─────────────────────────────────────────────────────

describe('KPI Registry – Preset Application', () => {
    it('applies Strict preset (higher exclusion)', () => {
        // In Strict, global minSpend is 50. Row with 30 should be excluded.
        const rows = [
            mkRow(200, 20000, 1000),
            mkRow(30, 20000, 1000),
        ];

        const result = computeKPIs(rows, { ...defaultOptions, preset: 'Strict' });
        expect(result.CPM?.sampleSize).toBe(1); // One row excluded
        expect(result.CPM?.exclusionSummary.totalExcluded).toBe(1);
    });
});
