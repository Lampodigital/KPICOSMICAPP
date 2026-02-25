import { CanonicalRow } from '@/lib/data/normalize';

export type OutlierPreset = 'Strict' | 'Normal' | 'Loose';

const PRESET_MULTIPLIERS: Record<OutlierPreset, number> = {
    Strict: 1.0,
    Normal: 1.5,
    Loose: 2.0,
};

export interface OutlierThresholds {
    minSpend: number;      // default 10
    minImpressions: number; // default 1000
}

export interface ExclusionResult {
    included: CanonicalRow[];
    excluded: Array<{ row: CanonicalRow; reasons: string[] }>;
    summary: {
        totalIn: number;
        totalOut: number;
        iqrOutliers: number;
        belowThreshold: number;
    };
}

function iqrBounds(values: number[], multiplier: number): [number, number] {
    if (values.length < 4) return [-Infinity, Infinity];
    const sorted = [...values].sort((a, b) => a - b);
    const q1 = sorted[Math.floor(sorted.length * 0.25)];
    const q3 = sorted[Math.floor(sorted.length * 0.75)];
    const iqr = q3 - q1;
    return [q1 - multiplier * iqr, q3 + multiplier * iqr];
}

/**
 * Applies outlier exclusion per a key metric (e.g. CPM value).
 * Can be called per KPI independently.
 */
export function excludeOutliers(
    rows: CanonicalRow[],
    getMetric: (r: CanonicalRow) => number | null,
    preset: OutlierPreset,
    thresholds: OutlierThresholds
): ExclusionResult {
    const multiplier = PRESET_MULTIPLIERS[preset];
    const included: CanonicalRow[] = [];
    const excluded: Array<{ row: CanonicalRow; reasons: string[] }> = [];
    let belowThreshold = 0;

    // First pass: filter by minimum thresholds
    const afterThreshold = rows.filter((row) => {
        const reasons: string[] = [];
        if (row.spend < thresholds.minSpend) reasons.push(`spend < ${thresholds.minSpend}`);
        if (row.impressions < thresholds.minImpressions) reasons.push(`impressions < ${thresholds.minImpressions}`);
        if (reasons.length > 0) {
            excluded.push({ row, reasons: reasons.map(r => `below_min_threshold: ${r}`) });
            belowThreshold++;
            return false;
        }
        return true;
    });

    // Compute valid metric values for IQR
    const metrics = afterThreshold
        .map((r) => getMetric(r))
        .filter((v): v is number => v !== null && isFinite(v));

    const [lo, hi] = iqrBounds(metrics, multiplier);
    let iqrOutliers = 0;

    for (const row of afterThreshold) {
        const metric = getMetric(row);
        if (metric !== null && (metric < lo || metric > hi)) {
            excluded.push({ row, reasons: [`iqr_outlier: value ${metric.toFixed(4)} outside [${lo.toFixed(4)}, ${hi.toFixed(4)}]`] });
            iqrOutliers++;
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
        },
    };
}
