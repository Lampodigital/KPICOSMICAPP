import 'dotenv/config';
import { prisma } from './src/lib/db';
import { parseExcelBuffer } from './src/lib/data/parser';
import { applyFilters } from './src/lib/filters/apply';
import { computeKPIs } from './src/lib/kpis/registry';
import { DEFAULT_MAPPING } from './src/lib/mapping/index';
import { readFile } from 'fs/promises';
import path from 'path';

async function diagnose() {
    console.log('Fetching config from DB...');
    const config = await prisma.appConfig.findUnique({ where: { id: 1 } });
    console.log('Config:', config);

    if (!config?.dataFileKey) {
        console.log('No file uploaded yet.');
        return;
    }

    console.log('Fetching mapping from DB...');
    const dbMappings = await prisma.columnMapping.findMany();
    const mapping = dbMappings.length > 0
        ? Object.fromEntries(dbMappings.map((m) => [m.canonicalField, m.sheetHeader]))
        : DEFAULT_MAPPING;
    console.log('Mapping keys:', Object.keys(mapping).length);

    console.log('Reading file:', config.dataFileKey);
    const filePath = path.join(process.cwd(), '.tmp', 'uploads', config.dataFileKey);
    const buffer = await readFile(filePath);
    console.log('File size:', buffer.length);

    console.log('Parsing Excel...');
    const { rows, errors } = parseExcelBuffer(buffer, mapping);
    console.log('Parsed rows:', rows.length);
    if (errors.length > 0) {
        console.log('Parser errors:', errors.slice(0, 5));
    }

    if (rows.length === 0) {
        console.log('⚠️ No rows parsed! This would cause a 422 error, NOT a 500.');
        return;
    }

    console.log('Applying filters (empty)...');
    const filtered = applyFilters(rows, {});
    console.log('Filtered rows:', filtered.length);

    if (filtered.length === 0) {
        console.log('⚠️ Filters excluded all rows! This would cause a 422 error, NOT a 500.');
        return;
    }

    console.log('Computing KPIs...');
    try {
        const kpis = computeKPIs(filtered, {
            marginPct: 0,
            preset: 'Balanced',
            // Pass the custom thresholds if they exist in config
            customThresholds: (config as any).qualityPresetsOverrides as any,
            customBadgeThresholds: (config as any).badgeThresholdsOverrides as any
        });
        console.log('KPI computation SUCCESS.');

        // Show results for CPM and CPC specifically
        ['CPM', 'CPC', 'CTR'].forEach(key => {
            const val = (kpis as any)[key];
            if (val) {
                console.log(`\n--- ${key} ---`);
                console.log(`Raw: ${val.raw}, Adjusted: ${val.adjusted}`);
                console.log(`Reliability: ${val.reliability}`);
                console.log(`Sample Size: ${val.sampleSize}`);
                console.log(`Exclusion Summary:`, {
                    totalExcluded: val.exclusionSummary.totalExcluded,
                    iqrOutliers: val.exclusionSummary.iqrOutliers,
                    belowThreshold: val.exclusionSummary.belowThreshold,
                    excludedSpendPct: `${val.exclusionSummary.excludedSpendPct.toFixed(2)}%`
                });
                if (val.exclusionSummary.topExcluded.length > 0) {
                    console.log(`Top Excluded (up to 3):`);
                    val.exclusionSummary.topExcluded.slice(0, 3).forEach((ex: any, i: number) => {
                        console.log(`  ${i + 1}. ${ex.campaignName} - Spend: ${ex.spend} - Reasons: ${ex.reasons.join(', ')}`);
                    });
                }
            }
        });

        /* Commenting out Audit Log to avoid valid user requirement issues during diagnostic
        console.log('\nTesting Audit Log creation...');
        // ...
        */

    } catch (e: any) {
        console.error('❌ KPI computation CRASHED:', e.message);
        console.error(e.stack);
    }
}

diagnose().then(() => prisma.$disconnect()).catch(console.error);
