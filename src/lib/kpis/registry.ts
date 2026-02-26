import { CanonicalRow } from '@/lib/data/normalize';
import { excludeOutliers } from '@/lib/outliers';
import { QualityThresholds, OutlierPreset, PRESETS, ReliabilityBadge, BadgeThresholds, DEFAULT_BADGE_THRESHOLDS } from '@/lib/outliers/config';

export interface KpiValue {
    raw: number | null;
    adjusted: number | null; // after margin adjustment (cost KPIs only)
    sampleSize: number;
    exclusionSummary: {
        totalExcluded: number;
        iqrOutliers: number;
        belowThreshold: number;
        excludedSpendPct: number;
        topExcluded: Array<{
            campaignName: string;
            market: string;
            objective: string;
            spend: number;
            impressions: number;
            clicks: number;
            videoViews6s: number;
            computedValue: number | null;
            reasons: string[];
        }>;
    };
    reliability: ReliabilityBadge;
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
    customThresholds?: QualityThresholds; // From admin overrides
    customBadgeThresholds?: BadgeThresholds; // From admin overrides
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
    getDenominator: (r: CanonicalRow) => number,
    marginPct: number,
    isCostKpi: boolean,
    thresholds: QualityThresholds,
    badgeThresholds: BadgeThresholds,
    minDenominator: number = 0
): KpiValue {
    const { included, excluded, summary } = excludeOutliers(rows, getMetric, getDenominator, thresholds, minDenominator);
    const values = included.map(getMetric).filter((v): v is number => v !== null && isFinite(v));

    // A KPI is computable if we have at least one valid metric value after filtering.
    // The per-row minDenominator is already enforced in excludeOutliers (Stage 1).
    const rawAvg = values.length > 0 ? avg(values) : null;

    const excludedSpendPct = summary.totalSpend > 0
        ? (summary.excludedSpend / summary.totalSpend) * 100
        : 0;

    let reliability: ReliabilityBadge = 'Unavailable';
    if (included.length > 0) {
        const rowsUsed = included.length;
        const spendUsed = included.reduce((sum, r) => sum + r.spend, 0);

        if (
            rowsUsed >= badgeThresholds.high.minRows &&
            spendUsed >= badgeThresholds.high.minSpend &&
            excludedSpendPct <= badgeThresholds.high.maxExcludedPct
        ) {
            reliability = 'High';
        } else if (
            rowsUsed < badgeThresholds.medium.minRows ||
            spendUsed < badgeThresholds.medium.minSpend ||
            excludedSpendPct > badgeThresholds.medium.maxExcludedPct
        ) {
            reliability = 'Low';
        } else {
            reliability = 'Medium';
        }
    }

    const topExcluded = summary.totalOut > 0
        ? [...excluded]
            .sort((a, b) => b.row.spend - a.row.spend)
            .slice(0, 50)
            .map(x => ({
                campaignName: x.row.campaignName || 'Unknown Campaign',
                market: x.row.market || 'Unknown',
                objective: x.row.objective || 'Unknown',
                spend: x.row.spend,
                impressions: x.row.impressions,
                clicks: x.row.clicks,
                videoViews6s: x.row.videoViews6s,
                computedValue: getMetric(x.row),
                reasons: x.reasons
            }))
        : [];

    return {
        raw: rawAvg,
        adjusted: rawAvg !== null && isCostKpi ? applyMargin(rawAvg, marginPct) : rawAvg,
        sampleSize: included.length,
        exclusionSummary: {
            totalExcluded: summary.totalOut,
            iqrOutliers: summary.iqrOutliers,
            belowThreshold: summary.belowThreshold,
            excludedSpendPct: excludedSpendPct,
            topExcluded
        },
        reliability
    };
}

export function computeKPIs(rows: CanonicalRow[], options: AnalyzeOptions): KpiOutput {
    const { marginPct, preset, customThresholds, customBadgeThresholds } = options;
    const thresholds = customThresholds ?? PRESETS[preset] ?? PRESETS['Balanced'];
    const badgeThresholds = customBadgeThresholds ?? DEFAULT_BADGE_THRESHOLDS;
    const kpiThresh = thresholds.kpi;

    return {
        CPM: computeKpi(
            rows,
            (r) => r.impressions > 0 ? (r.spend / r.impressions) * 1000 : null,
            (r) => r.impressions,
            marginPct, true, thresholds, badgeThresholds, kpiThresh.CPM.minImpressions
        ),
        CPC: computeKpi(
            rows,
            (r) => r.clicks > 0 ? r.spend / r.clicks : null,
            (r) => r.clicks,
            marginPct, true, thresholds, badgeThresholds, kpiThresh.CPC.minClicks
        ),
        CPV: computeKpi(
            rows,
            (r) => r.videoViews > 0 ? r.spend / r.videoViews : null,
            (r) => r.videoViews,
            marginPct, true, thresholds, badgeThresholds, 0 // No specific default given for CPV, fallback to 0
        ),
        CPV6: computeKpi(
            rows,
            (r) => r.videoViews6s > 0 ? r.spend / r.videoViews6s : null,
            (r) => r.videoViews6s,
            marginPct, true, thresholds, badgeThresholds, kpiThresh.CPV6.minVideoViews6s
        ),
        CTR: computeKpi(
            rows,
            (r) => r.impressions > 0 ? r.clicks / r.impressions : null,
            (r) => r.impressions,
            0, false, thresholds, badgeThresholds, kpiThresh.CTR.minImpressions
        ),
        ER: computeKpi(
            rows,
            (r) => r.impressions > 0 ? (r.paidLikes + r.paidComments + r.paidShares) / r.impressions : null,
            (r) => r.impressions,
            0, false, thresholds, badgeThresholds, 0 // No default for ER
        ),
        VTR6: computeKpi(
            rows,
            (r) => r.impressions > 0 && r.videoViews6s > 0 ? r.videoViews6s / r.impressions : null,
            (r) => r.impressions,
            0, false, thresholds, badgeThresholds, 0 // No default for VTR6
        ),
        CPSF: computeKpi(
            rows,
            (r) => r.formSubmissions > 0 ? r.spend / r.formSubmissions : null,
            (r) => r.formSubmissions,
            marginPct, true, thresholds, badgeThresholds, 0
        ),
    };
}
