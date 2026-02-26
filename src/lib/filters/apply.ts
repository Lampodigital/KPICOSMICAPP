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
        const mMarket = row.market?.toUpperCase();
        if (filters.market?.length && mMarket && !filters.market.some(m => m.toUpperCase() === mMarket)) return false;

        const mObjective = row.objective?.toUpperCase();
        if (filters.objective?.length && mObjective && !filters.objective.some(o => {
            const opt = o.toUpperCase();
            if (opt === 'VIDEO VIEWS' && mObjective === 'VIDEO VIEW') return true;
            if (opt === 'VIDEO VIEW' && mObjective === 'VIDEO VIEWS') return true;
            return opt === mObjective;
        })) return false;

        const mSector = row.sector?.toUpperCase();
        if (filters.sector?.length && mSector && !filters.sector.some(s => s.toUpperCase() === mSector)) return false;
        if (filters.periodFrom && row.period && row.period < filters.periodFrom) return false;
        if (filters.periodTo && row.period && row.period > filters.periodTo) return false;
        return true;
    });
}
