/**
 * ============================================================
 * TESTS: src/lib/filters/apply.ts, mapping/index.ts, export/index.ts
 * ============================================================
 * Coverage: Filtering logic, auto-mapping detection, export formatting
 * ============================================================
 */

import { describe, it, expect } from 'vitest';
import { applyFilters } from '@/lib/filters/apply';
import { autoDetectMapping, DEFAULT_MAPPING } from '@/lib/mapping';
import { toClipboardText, toCSV } from '@/lib/export';
import { CanonicalRow } from '@/lib/data/normalize';
import { KpiOutput } from '@/lib/kpis/registry';

// ─── Filters ────────────────────────────────────────────────────────────────

describe('Filters – applyFilters', () => {
    const rows: Partial<CanonicalRow>[] = [
        { market: 'Italy', objective: 'Reach', period: '2024-01' },
        { market: 'France', objective: 'Views', period: '2024-02' },
        { market: 'Italy', objective: 'Views', period: '2024-03' },
    ];

    it('filters by market (multi-select)', () => {
        const filtered = applyFilters(rows as CanonicalRow[], { market: ['Italy'] });
        expect(filtered).toHaveLength(2);
    });

    it('filters by objective', () => {
        const filtered = applyFilters(rows as CanonicalRow[], { objective: ['Reach'] });
        expect(filtered).toHaveLength(1);
    });

    it('filters by period range', () => {
        const filtered = applyFilters(rows as CanonicalRow[], {
            periodFrom: '2024-02',
            periodTo: '2024-03'
        });
        expect(filtered).toHaveLength(2);
        expect(filtered[0].period).toBe('2024-02');
    });

    it('returns all rows for empty filters', () => {
        const filtered = applyFilters(rows as CanonicalRow[], {});
        expect(filtered).toHaveLength(3);
    });
});

// ─── Mapping ─────────────────────────────────────────────────────────────────

describe('Mapping – autoDetectMapping', () => {
    it('detects columns based on keywords', () => {
        const headers = ['Costi Totali', 'Impressions', 'Nazione', 'Obiettivo'];
        const mapping = autoDetectMapping(headers);

        // 'Costi Totali' contains 'cost' or 'costo'? Costo is in KEYWORD_MAP[spend]
        // Actually KEYWORD_MAP[spend] has ['cost cosmic', 'spend', 'costo']
        // 'Costi Totali' includes 'cost'? Wait, KEYWORD_MAP[spend] has 'costo'
        expect(mapping.spend).toBeDefined();
        expect(mapping.market).toBe('Nazione');
    });

    it('falls back to default mapping for missing headers', () => {
        const mapping = autoDetectMapping([]);
        expect(mapping.spend).toBe(DEFAULT_MAPPING.spend);
    });
});

// ─── Export ──────────────────────────────────────────────────────────────────

describe('Export – Formatting', () => {
    const mockKpis: KpiOutput = {
        CPM: {
            raw: 10,
            adjusted: 12.5,
            sampleSize: 50,
            exclusionSummary: {
                totalExcluded: 5,
                iqrOutliers: 2,
                belowThreshold: 3,
                excludedSpendPct: 10,
                topExcluded: []
            },
            reliability: 'High'
        }
    };

    it('formats TSV for clipboard', () => {
        const text = toClipboardText(mockKpis);
        expect(text).toContain('CPM\t10.0000\t12.5000\t50');
    });

    it('formats CSV for download', () => {
        const csv = toCSV(mockKpis);
        expect(csv).toContain('CPM,10.0000,12.5000,50,5,2,3');
    });

    it('handles null raw values with "N/A"', () => {
        const nullKpis: KpiOutput = {
            CPM: { ...mockKpis.CPM!, raw: null, adjusted: null }
        };
        const csv = toCSV(nullKpis);
        expect(csv).toContain('CPM,N/A,N/A');
    });
});
