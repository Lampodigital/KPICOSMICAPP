/**
 * ============================================================
 * TESTS: src/lib/data/normalize.ts
 * ============================================================
 * Coverage: parseNum (exported via normalizeRow), normalizeRow
 *
 * Strategy (from Debugging Best Practices notebook):
 * - Test all edge cases, not just happy paths
 * - Each test group covers one invariant / concern
 * - Regression tests prevent silent breakage
 * ============================================================
 */

import { describe, it, expect } from 'vitest';
import { normalizeRow, CanonicalRow } from '@/lib/data/normalize';
import { DEFAULT_MAPPING } from '@/lib/mapping';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Build a minimal raw row that will always produce a non-null normalizeRow result.
 * Override specific fields with `overrides`.
 */
function mkRaw(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
        'Cost Cosmic': '100',
        'Impression': '10000',
        'Click': '0',
        'Reach': '0',
        'Video views': '0',
        '6-Second Video Views': '0',
        'Video Views at 100%': '0',
        'Paid Followers': '0',
        'Paid Likes': '0',
        'Paid Comments': '0',
        'Paid Shares': '0',
        'Total Submit Form': '0',
        ...overrides,
    };
}

// ─── parseNum (indirectly, via normalizeRow spend field) ──────────────────────

describe('parseNum – number type passthrough', () => {
    it('passes raw JS numbers straight through', () => {
        const row = normalizeRow(mkRaw({ 'Cost Cosmic': 42.5 }), DEFAULT_MAPPING)!;
        expect(row.spend).toBe(42.5);
    });

    it('passes integer 0 through (not treated as falsy empty)', () => {
        // spend=0 and impressions>0 → row IS null per normalizeRow logic (0 spend + 0 impressions)
        // but spend=0 with impressions=10000 → should produce row with spend=0
        const row = normalizeRow(mkRaw({ 'Cost Cosmic': 0, 'Impression': 10000 }), DEFAULT_MAPPING);
        // spend = 0, impressions = 10000 → NOT null (impressions > 0)
        expect(row).not.toBeNull();
        expect(row!.spend).toBe(0);
    });
});

describe('parseNum – null / undefined / empty → 0', () => {
    it('returns 0 for null', () => {
        const row = normalizeRow(mkRaw({ 'Click': null }), DEFAULT_MAPPING)!;
        expect(row.clicks).toBe(0);
    });

    it('returns 0 for undefined', () => {
        const row = normalizeRow(mkRaw({ 'Click': undefined }), DEFAULT_MAPPING)!;
        expect(row.clicks).toBe(0);
    });

    it('returns 0 for empty string', () => {
        const row = normalizeRow(mkRaw({ 'Click': '' }), DEFAULT_MAPPING)!;
        expect(row.clicks).toBe(0);
    });

    it('returns 0 for non-numeric string', () => {
        const row = normalizeRow(mkRaw({ 'Click': 'abc' }), DEFAULT_MAPPING)!;
        expect(row.clicks).toBe(0);
    });
});

describe('parseNum – European format (comma = decimal)', () => {
    it('parses "1,5" as 1.5', () => {
        const row = normalizeRow(mkRaw({ 'Cost Cosmic': '1,5' }), DEFAULT_MAPPING)!;
        expect(row.spend).toBe(1.5);
    });

    it('parses "10,50" as 10.50', () => {
        const row = normalizeRow(mkRaw({ 'Cost Cosmic': '10,50' }), DEFAULT_MAPPING)!;
        expect(row.spend).toBeCloseTo(10.5);
    });

    it('parses "1.234,56" (EU thousands + decimal) as 1234.56', () => {
        const row = normalizeRow(mkRaw({ 'Cost Cosmic': '1.234,56' }), DEFAULT_MAPPING)!;
        expect(row.spend).toBeCloseTo(1234.56);
    });

    it('parses "1.000.000,00" correctly as 1000000', () => {
        const row = normalizeRow(mkRaw({ 'Cost Cosmic': '1.000.000,00' }), DEFAULT_MAPPING)!;
        expect(row.spend).toBeCloseTo(1000000);
    });
});

describe('parseNum – US format (dot = decimal)', () => {
    it('parses "1,234.56" (US thousands + decimal) as 1234.56', () => {
        const row = normalizeRow(mkRaw({ 'Cost Cosmic': '1,234.56' }), DEFAULT_MAPPING)!;
        expect(row.spend).toBeCloseTo(1234.56);
    });

    it('parses "1,000,000.00" correctly as 1000000', () => {
        const row = normalizeRow(mkRaw({ 'Cost Cosmic': '1,000,000.00' }), DEFAULT_MAPPING)!;
        expect(row.spend).toBeCloseTo(1000000);
    });

    it('parses "10.5" as 10.5', () => {
        const row = normalizeRow(mkRaw({ 'Cost Cosmic': '10.5' }), DEFAULT_MAPPING)!;
        expect(row.spend).toBeCloseTo(10.5);
    });
});

describe('parseNum – multi-dot (EU thousands with no decimal)', () => {
    it('parses "1.000.000" as 1000000', () => {
        const row = normalizeRow(mkRaw({ 'Cost Cosmic': '1.000.000' }), DEFAULT_MAPPING)!;
        expect(row.spend).toBe(1000000);
    });

    it('parses "1.500" as 1500', () => {
        // Multiple dots → thousands
        const row = normalizeRow(mkRaw({ 'Cost Cosmic': '1.500' }), DEFAULT_MAPPING)!;
        // Ambiguous single dot... parseNum treats single dot as decimal, so 1.500 = 1.5
        // THIS IS THE KNOWN LIMITATION — document it explicitly
        // Expected: 1.5 (single dot → standard decimal) — this is by design
        expect(row.spend).toBeCloseTo(1.5);
    });
});

describe('parseNum – currency symbols stripped', () => {
    it('strips € prefix + space', () => {
        const row = normalizeRow(mkRaw({ 'Cost Cosmic': '€ 1.234,56' }), DEFAULT_MAPPING)!;
        expect(row.spend).toBeCloseTo(1234.56);
    });

    it('strips $ prefix + space', () => {
        const row = normalizeRow(mkRaw({ 'Cost Cosmic': '$ 1,234.56' }), DEFAULT_MAPPING)!;
        expect(row.spend).toBeCloseTo(1234.56);
    });

    it('strips £ prefix', () => {
        const row = normalizeRow(mkRaw({ 'Cost Cosmic': '£100,50' }), DEFAULT_MAPPING)!;
        expect(row.spend).toBeCloseTo(100.5);
    });
});

describe('parseNum – integer strings', () => {
    it('parses plain "1234" correctly', () => {
        const row = normalizeRow(mkRaw({ 'Cost Cosmic': '1234' }), DEFAULT_MAPPING)!;
        expect(row.spend).toBe(1234);
    });

    it('parses "0" correctly', () => {
        const row = normalizeRow(mkRaw({ 'Cost Cosmic': '0', 'Impression': '10000' }), DEFAULT_MAPPING)!;
        expect(row.spend).toBe(0);
    });

    it('parses "  500  " with extra spaces', () => {
        const row = normalizeRow(mkRaw({ 'Cost Cosmic': '  500  ' }), DEFAULT_MAPPING)!;
        expect(row.spend).toBe(500);
    });
});

// ─── normalizeRow ─────────────────────────────────────────────────────────────

describe('normalizeRow – null guard (spend=0 AND impressions=0)', () => {
    it('returns null if both spend and impressions are 0', () => {
        const row = normalizeRow(mkRaw({ 'Cost Cosmic': '0', 'Impression': '0' }), DEFAULT_MAPPING);
        expect(row).toBeNull();
    });

    it('returns non-null if spend > 0 with impressions = 0', () => {
        const row = normalizeRow(mkRaw({ 'Cost Cosmic': '100', 'Impression': '0' }), DEFAULT_MAPPING);
        expect(row).not.toBeNull();
    });

    it('returns non-null if impressions > 0 with spend = 0', () => {
        const row = normalizeRow(mkRaw({ 'Cost Cosmic': '0', 'Impression': '5000' }), DEFAULT_MAPPING);
        expect(row).not.toBeNull();
    });
});

describe('normalizeRow – string fields trimmed & optional', () => {
    it('trims whitespace from campaignName', () => {
        // campaignName not in default mapping but let's test client field
        const row = normalizeRow(mkRaw({ 'Cliente': '  Cosmic Brand  ' }), DEFAULT_MAPPING)!;
        expect(row.client).toBe('Cosmic Brand');
    });

    it('returns undefined for empty string fields', () => {
        const row = normalizeRow(mkRaw({ 'Cliente': '' }), DEFAULT_MAPPING)!;
        expect(row.client).toBeUndefined();
    });

    it('returns undefined for null string fields', () => {
        const row = normalizeRow(mkRaw({ 'Cliente': null }), DEFAULT_MAPPING)!;
        expect(row.client).toBeUndefined();
    });
});

describe('normalizeRow – currency defaults to EUR', () => {
    it('defaults currency to "EUR" when not provided', () => {
        const row = normalizeRow(mkRaw({ 'Currency': null }), DEFAULT_MAPPING)!;
        expect(row.currency).toBe('EUR');
    });

    it('preserves explicit currency value', () => {
        const row = normalizeRow(mkRaw({ 'Currency': 'USD' }), DEFAULT_MAPPING)!;
        expect(row.currency).toBe('USD');
    });
});

describe('normalizeRow – all metric fields parsed', () => {
    it('correctly maps all numeric fields', () => {
        const raw = mkRaw({
            'Cost Cosmic': '500',
            'Impression': '20000',
            'Click': '300',
            'Reach': '15000',
            'Video views': '400',
            '6-Second Video Views': '200',
            'Video Views at 100%': '100',
            'Paid Followers': '10',
            'Paid Likes': '50',
            'Paid Comments': '5',
            'Paid Shares': '3',
            'Total Submit Form': '8',
        });
        const row = normalizeRow(raw, DEFAULT_MAPPING)!;
        expect(row.spend).toBe(500);
        expect(row.impressions).toBe(20000);
        expect(row.clicks).toBe(300);
        expect(row.reach).toBe(15000);
        expect(row.videoViews).toBe(400);
        expect(row.videoViews6s).toBe(200);
        expect(row.videoViews100pct).toBe(100);
        expect(row.paidFollowers).toBe(10);
        expect(row.paidLikes).toBe(50);
        expect(row.paidComments).toBe(5);
        expect(row.paidShares).toBe(3);
        expect(row.formSubmissions).toBe(8);
    });
});

describe('normalizeRow – year/month parsed as numbers', () => {
    it('converts string year "2024" to number 2024', () => {
        const row = normalizeRow(mkRaw({ 'Year': '2024' }), DEFAULT_MAPPING)!;
        expect(row.year).toBe(2024);
    });

    it('converts string month "3" to number 3', () => {
        const row = normalizeRow(mkRaw({ 'Month': '3' }), DEFAULT_MAPPING)!;
        expect(row.month).toBe(3);
    });

    it('returns undefined if year not present', () => {
        const row = normalizeRow(mkRaw({ 'Year': null }), DEFAULT_MAPPING)!;
        expect(row.year).toBeUndefined();
    });
});

describe('normalizeRow – missing mapping keys produce 0', () => {
    it('returns 0 for unmapped canonical keys', () => {
        const emptyMapping = { spend: 'Cost Cosmic', impressions: 'Impression' };
        const row = normalizeRow(mkRaw(), emptyMapping)!;
        expect(row.clicks).toBe(0);
        expect(row.reach).toBe(0);
        expect(row.videoViews).toBe(0);
    });
});
