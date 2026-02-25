import { CanonicalRow } from '@/lib/data/normalize';
import { excludeOutliers, OutlierPreset, OutlierThresholds } from '@/lib/outliers';

export interface KpiValue {
    raw: number | null;
    adjusted: number | null; // after margin adjustment (cost KPIs only)
    sampleSize: number;
    exclusionSummary: {
        totalExcluded: number;
        iqrOutliers: number;
        belowThreshold: number;
    };
}

export interface KpiOutput {
    CPM?: KpiValue;
    CPC?: KpiValue;
    CPV?: KpiValue;
    CPV6?: KpiValue;
    CTR?: KpiValue;
    ER?: KpiValue;
    VTR6?: KpiValue;
    CPSF?: KpiValue;
}

export interface AnalyzeOptions {
    marginPct: number; // 0–100
    preset: OutlierPreset;
    thresholds: OutlierThresholds;
}

function applyMargin(value: number, marginPct: number): number {
    if (marginPct <= 0 || marginPct >= 100) return value;
    return value / (1 - marginPct / 100);
}

function avg(nums: number[]): number | null {
    const valid = nums.filter(isFinite);
    if (valid.length === 0) return null;
    return valid.reduce((a, b) => a + b, 0) / valid.length;
}

function computeKpi(
    rows: CanonicalRow[],
    getMetric: (r: CanonicalRow) => number | null,
    preset: OutlierPreset,
    thresholds: OutlierThresholds,
    marginPct: number,
    isCostKpi: boolean
): KpiValue {
    const { included, summary } = excludeOutliers(rows, getMetric, preset, thresholds);
    const values = included.map(getMetric).filter((v): v is number => v !== null);
    const rawAvg = avg(values);
    return {
        raw: rawAvg,
        adjusted: rawAvg !== null && isCostKpi ? applyMargin(rawAvg, marginPct) : rawAvg,
        sampleSize: included.length,
        exclusionSummary: {
            totalExcluded: summary.totalOut,
            iqrOutliers: summary.iqrOutliers,
            belowThreshold: summary.belowThreshold,
        },
    };
}

export function computeKPIs(rows: CanonicalRow[], options: AnalyzeOptions): KpiOutput {
    const { marginPct, preset, thresholds } = options;

    const kpiRow = (fn: (r: CanonicalRow) => number | null) => fn;

    return {
        // CPM = spend / impressions * 1000
        CPM: computeKpi(
            rows,
            kpiRow((r) => r.impressions > 0 ? (r.spend / r.impressions) * 1000 : null),
            preset, thresholds, marginPct, true
        ),
        // CPC = spend / clicks
        CPC: computeKpi(
            rows,
            kpiRow((r) => r.clicks > 0 ? r.spend / r.clicks : null),
            preset, thresholds, marginPct, true
        ),
        // CPV = spend / videoViews
        CPV: computeKpi(
            rows,
            kpiRow((r) => r.videoViews > 0 ? r.spend / r.videoViews : null),
            preset, thresholds, marginPct, true
        ),
        // CPV6 = spend / videoViews6s
        CPV6: computeKpi(
            rows,
            kpiRow((r) => r.videoViews6s > 0 ? r.spend / r.videoViews6s : null),
            preset, thresholds, marginPct, true
        ),
        // CTR = clicks / impressions (ratio — no margin adjustment)
        CTR: computeKpi(
            rows,
            kpiRow((r) => r.impressions > 0 ? r.clicks / r.impressions : null),
            preset, thresholds, 0, false
        ),
        // ER = (likes+comments+shares) / impressions (ratio — no margin)
        ER: computeKpi(
            rows,
            kpiRow((r) => r.impressions > 0
                ? (r.paidLikes + r.paidComments + r.paidShares) / r.impressions
                : null),
            preset, thresholds, 0, false
        ),
        // VTR6 = videoViews6s / impressions (ratio — no margin)
        VTR6: computeKpi(
            rows,
            kpiRow((r) => r.impressions > 0 && r.videoViews6s > 0
                ? r.videoViews6s / r.impressions
                : null),
            preset, thresholds, 0, false
        ),
        // CPSF = spend / formSubmissions
        CPSF: computeKpi(
            rows,
            kpiRow((r) => r.formSubmissions > 0 ? r.spend / r.formSubmissions : null),
            preset, thresholds, marginPct, true
        ),
    };
}
