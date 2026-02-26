import { excludeOutliers } from './src/lib/outliers';
import { PRESETS } from './src/lib/outliers/config';
import { CanonicalRow } from './src/lib/data/normalize';

function makeRow(spend: number, impressions: number, clicks: number, name: string): CanonicalRow {
    return {
        campaignName: name,
        objStr: 'CONVERSIONS',
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
        formSubmissions: 0,
        reach: 0
    } as CanonicalRow;
}

console.log('--- TEST 1: MAD Fallback for identical values ---');
// 20 identical rows, 1 extreme outlier
const rows1 = Array.from({ length: 20 }, (_, i) => makeRow(100, 10000, 100, `Normal ${i}`));
rows1.push(makeRow(2000, 10000, 10, 'Outlier')); // CPM = 200

// Test CPM (cost kpi)
const res1 = excludeOutliers(
    rows1,
    r => (r.spend / r.impressions) * 1000,
    r => r.impressions,
    PRESETS['Balanced'], // multiplier 2.0
    1000, // min impressions
    true // isCostKpi = true -> Log Space + MAD
);

console.log('Total:', res1.summary.totalIn + res1.summary.totalOut);
console.log('Excluded:', res1.summary.totalOut);
console.log('Excluded names:', res1.excluded.map(x => x.row.campaignName).join(', '));
console.log('Outlier Reasons:', res1.excluded.map(x => x.reasons).flat().join(', '));
console.log('\n');

console.log('--- TEST 2: Log-Transformed Skewness Handling ---');
// Simulating typical right-skewed CPM data (a long tail of expensive clicks)
// Normal IQR would flag the tail as outliers because the distribution isn't symmetric.
// Log-IQR should keep them because they fit the log-normal curve.
const rows2 = [
    10, 10, 11, 11, 12, 12, 13, 13, 14, 15,
    18, 22, 28, 35, 45, 60 // Heavy right tail
].map((cpm, i) => makeRow(cpm * 10, 1000, 10, `Tail ${i}`));

// Also add one crazy actual error
rows2.push(makeRow(500 * 10, 1000, 10, 'True Outlier')); // CPM 500

const res2 = excludeOutliers(
    rows2,
    r => (r.spend / r.impressions) * 1000,
    r => r.impressions,
    PRESETS['Balanced'],
    100,
    true
);

console.log('Excluded names:', res2.excluded.map(x => x.row.campaignName).join(', '));
