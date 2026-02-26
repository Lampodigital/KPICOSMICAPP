import * as XLSX from 'xlsx';
import { normalizeRow, CanonicalRow } from '@/lib/data/normalize';
import { ColumnMappingMap } from '@/lib/mapping';

export interface ParseResult {
    rows: CanonicalRow[];
    rawHeaders: string[];
    validRowCount: number;
    totalRowCount: number;
    errors: string[];
}

export function parseExcelBuffer(buffer: Buffer, mapping: ColumnMappingMap): ParseResult {
    const errors: string[] = [];
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });

    // Use first sheet
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rawData: Record<string, unknown>[] = XLSX.utils.sheet_to_json(worksheet, {
        defval: null,
        raw: false,
    });

    if (rawData.length === 0) {
        return { rows: [], rawHeaders: [], validRowCount: 0, totalRowCount: 0, errors: ['Sheet is empty'] };
    }

    const rawHeaders = Object.keys(rawData[0] as object);
    const rows: CanonicalRow[] = [];

    for (const raw of rawData) {
        try {
            const normalized = normalizeRow(raw as Record<string, unknown>, mapping);
            if (normalized) rows.push(normalized);
        } catch (e: unknown) {
            errors.push(`Row parse error: ${e instanceof Error ? e.message : String(e)}`);
        }
    }

    return { rows, rawHeaders, validRowCount: rows.length, totalRowCount: rawData.length, errors };
}
