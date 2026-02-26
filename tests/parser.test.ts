import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { parseExcelBuffer } from '@/lib/data/parser';
import { DEFAULT_MAPPING } from '@/lib/mapping';

describe('Parser – parseExcelBuffer', () => {
    it('correctly parses an Excel buffer into CanonicalRows', () => {
        // Create a simple workbook
        const data = [
            { 'Cost Cosmic': '100', 'Impression': '10000', 'Click': '50', 'Currency': 'EUR' },
            { 'Cost Cosmic': '250.50', 'Impression': '25000', 'Click': '150', 'Currency': 'USD' },
            { 'Cost Cosmic': '0', 'Impression': '0' }, // Should be normalized to null per normalizeRow
        ];

        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');

        const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

        const { rows, rawHeaders, validRowCount, totalRowCount, errors } = parseExcelBuffer(buffer, DEFAULT_MAPPING);

        expect(rows).toHaveLength(2); // One was null (0, 0)
        expect(validRowCount).toBe(2);
        expect(totalRowCount).toBe(3); // 3 total in json 
        expect(rawHeaders).toContain('Cost Cosmic');
        expect(rawHeaders).toContain('Impression');
        expect(errors).toHaveLength(0);

        expect(rows[0].spend).toBe(100);
        expect(rows[1].spend).toBe(250.5);
        expect(rows[1].currency).toBe('USD');
    });

    it('returns an empty list for an empty sheet', () => {
        const workbook = XLSX.utils.book_new();
        const worksheet = XLSX.utils.json_to_sheet([]);
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Empty');
        const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

        const { rows, errors } = parseExcelBuffer(buffer, DEFAULT_MAPPING);
        expect(rows).toHaveLength(0);
        expect(errors).toContain('Sheet is empty');
    });
});
