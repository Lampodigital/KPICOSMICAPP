import { CanonicalRow } from '@/lib/data/normalize';

export interface FilterOptions {
    market?: string[];
    objective?: string[];
    sector?: string[];
    periodFrom?: string; // "YYYY-MM"
    periodTo?: string;   // "YYYY-MM"
    [key: string]: unknown;
}

export function applyFilters(rows: CanonicalRow[], filters: FilterOptions): CanonicalRow[] {
    return rows.filter((row) => {
        if (filters.market?.length && row.market && !filters.market.includes(row.market)) return false;
        if (filters.objective?.length && row.objective && !filters.objective.includes(row.objective)) return false;
        if (filters.sector?.length && row.sector && !filters.sector.includes(row.sector)) return false;
        if (filters.periodFrom && row.period && row.period < filters.periodFrom) return false;
        if (filters.periodTo && row.period && row.period > filters.periodTo) return false;
        return true;
    });
}
