import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/rbac/guards';
import { prisma } from '@/lib/db';
import { parseExcelBuffer } from '@/lib/data/parser';
import { autoDetectMapping } from '@/lib/mapping';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';

export async function POST(req: NextRequest) {
    const { error } = await requireAdmin();
    if (error) return error;

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext !== 'xlsx' && ext !== 'xls') {
        return NextResponse.json({ error: 'Only .xlsx or .xls files accepted' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Quick validation — try parsing with default mapping
    const { rawHeaders, totalRowCount, errors } = parseExcelBuffer(buffer, {});
    if (rawHeaders.length === 0) {
        return NextResponse.json({ error: 'File appears empty or unreadable', parseErrors: errors }, { status: 422 });
    }

    // Auto-detect mapping
    const detectedMapping = autoDetectMapping(rawHeaders);

    // Save file to .tmp/uploads
    const fileKey = `${randomUUID()}.${ext}`;
    const uploadsDir = path.join(process.cwd(), '.tmp', 'uploads');
    await mkdir(uploadsDir, { recursive: true });
    await writeFile(path.join(uploadsDir, fileKey), buffer);

    // Update AppConfig
    await prisma.appConfig.upsert({
        where: { id: 1 },
        update: { dataFileName: file.name, dataFileKey: fileKey },
        create: { id: 1, dataFileName: file.name, dataFileKey: fileKey, defaultOutlierPreset: 'Normal', defaultMinImpressions: 1000, defaultMinSpend: 10.0 },
    });

    // Save detected mapping to DB (upsert each field)
    for (const [canonical, sheetHeader] of Object.entries(detectedMapping)) {
        await prisma.columnMapping.upsert({
            where: { canonicalField: canonical },
            update: { sheetHeader },
            create: { canonicalField: canonical, sheetHeader },
        });
    }

    return NextResponse.json({
        ok: true,
        fileName: file.name,
        rowCount: totalRowCount,
        validRowCount: 0, // Since mapping was {}
        headers: rawHeaders,
        mapping: detectedMapping,
    });
}

export async function GET() {
    const { error } = await requireAdmin();
    if (error) return error;
    const config = await prisma.appConfig.findUnique({ where: { id: 1 } });
    const mapping = await prisma.columnMapping.findMany();
    return NextResponse.json({ config, mapping });
}
