import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/rbac/guards';
import { prisma } from '@/lib/db';
import { parseExcelBuffer } from '@/lib/data/parser';
import { applyFilters, FilterOptions } from '@/lib/filters/apply';
import { computeKPIs } from '@/lib/kpis/registry';
import { DEFAULT_MAPPING } from '@/lib/mapping';
import { OutlierPreset, QualityThresholds } from '@/lib/outliers/config';
import { readFile } from 'fs/promises';
import path from 'path';

export async function POST(req: NextRequest) {
    const { error, session } = await requireAuth();
    if (error) return error;

    const body = await req.json() as {
        filters: FilterOptions;
        marginPct: number;
        outlierPreset?: OutlierPreset;
        minImpressions?: number;
        minSpend?: number;
    };

    // Load active data file from db config
    const config = await prisma.appConfig.findUnique({ where: { id: 1 } });
    if (!config?.dataFileKey) {
        return NextResponse.json({ error: 'No data file configured. Please ask an Admin to upload the data source.' }, { status: 422 });
    }

    // Load column mapping
    const dbMappings = await prisma.columnMapping.findMany();
    const mapping = dbMappings.length > 0
        ? Object.fromEntries(dbMappings.map((m: { canonicalField: string; sheetHeader: string }) => [m.canonicalField, m.sheetHeader]))
        : DEFAULT_MAPPING;

    // Read file from uploads dir
    const uploadsDir = path.join(process.cwd(), '.tmp', 'uploads');
    const filePath = path.join(uploadsDir, config.dataFileKey);
    let buffer: Buffer;
    try {
        buffer = await readFile(filePath) as Buffer;
    } catch {
        return NextResponse.json({ error: 'Data file not found on server. Please re-upload.' }, { status: 422 });
    }

    const { rows, errors } = parseExcelBuffer(buffer, mapping);
    if (rows.length === 0) {
        return NextResponse.json({ error: 'No valid rows found in data file.', parseErrors: errors }, { status: 422 });
    }

    // Apply filters
    const filtered = applyFilters(rows, body.filters ?? {});
    if (filtered.length === 0) {
        return NextResponse.json({ error: 'No rows match the selected filters. Try broadening your selection.' }, { status: 422 });
    }

    const preset: OutlierPreset = body.outlierPreset ?? (config.defaultOutlierPreset as OutlierPreset) ?? 'Balanced';
    const customThresholds = (config as any).qualityPresetsOverrides as QualityThresholds | undefined;
    const customBadgeThresholds = (config as any).badgeThresholdsOverrides as any | undefined;

    const kpis = computeKPIs(filtered, { marginPct: body.marginPct ?? 0, preset, customThresholds, customBadgeThresholds });

    // Audit log — NO raw rows, only metadata
    await prisma.auditLog.create({
        data: {
            actorId: session!.userId,
            action: 'ANALYZE',
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            metadata: JSON.parse(JSON.stringify({
                filters: body.filters,
                marginPct: body.marginPct,
                preset,
                totalRows: rows.length,
                filteredRows: filtered.length,
            })),
        },
    });

    return NextResponse.json({ kpis, filteredRows: filtered.length, totalRows: rows.length });
}
