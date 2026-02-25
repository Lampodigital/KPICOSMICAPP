import { KpiOutput, KpiValue } from '@/lib/kpis/registry';

const KPI_LABELS: Record<string, { label: string; unit: string; pct?: boolean }> = {
    CPM: { label: 'CPM', unit: '€' },
    CPC: { label: 'CPC', unit: '€' },
    CPV: { label: 'CPV', unit: '€' },
    CPV6: { label: 'CPV6', unit: '€' },
    CTR: { label: 'CTR', unit: '%', pct: true },
    ER: { label: 'ER', unit: '%', pct: true },
    VTR6: { label: 'VTR6', unit: '%', pct: true },
    CPSF: { label: 'CPSF', unit: '€' },
};

function fmt(v: number | null | undefined, pct = false): string {
    if (v === null || v === undefined) return 'N/A';
    return pct ? (v * 100).toFixed(3) + '%' : v.toFixed(4);
}

/** Tab-separated format for clipboard pasting into spreadsheet */
export function toClipboardText(kpis: KpiOutput): string {
    const headerRow = ['KPI', 'Raw', 'Adjusted', 'Sample Size'].join('\t');
    const rows = Object.entries(kpis).map(([key, val]: [string, KpiValue | undefined]) => {
        if (!val) return null;
        const meta = KPI_LABELS[key];
        const pct = meta?.pct;
        return [
            meta?.label ?? key,
            fmt(val.raw, pct),
            fmt(val.adjusted, pct),
            val.sampleSize,
        ].join('\t');
    }).filter(Boolean);

    return [headerRow, ...rows].join('\n');
}

/** CSV string for download */
export function toCSV(kpis: KpiOutput): string {
    const headerRow = 'KPI,Raw,Adjusted,Sample Size,Excluded,IQR Outliers,Below Threshold\n';
    const rows = Object.entries(kpis).map(([key, val]: [string, KpiValue | undefined]) => {
        if (!val) return null;
        const meta = KPI_LABELS[key];
        const pct = meta?.pct;
        return [
            meta?.label ?? key,
            fmt(val.raw, pct),
            fmt(val.adjusted, pct),
            val.sampleSize,
            val.exclusionSummary.totalExcluded,
            val.exclusionSummary.iqrOutliers,
            val.exclusionSummary.belowThreshold,
        ].join(',');
    }).filter(Boolean);

    return headerRow + rows.join('\n');
}
