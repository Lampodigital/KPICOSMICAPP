'use client';
import { useState, useCallback } from 'react';
import { KpiOutput, KpiValue } from '@/lib/kpis/registry';

const OBJECTIVES = ['Reach', 'Traffic', 'Video Views', 'Community Interaction', 'Lead Generation', 'App Promotion', 'Sales', 'Branded Mission'];
const SECTORS = ['Fashion', 'Beauty', 'Luxury', 'FMCG', 'Retail', 'App & Services', 'Education', 'Entertainment', 'Tech & Finance', 'Automotive', 'Travel'];
const PRESETS = ['Strict', 'Normal', 'Loose'] as const;

const STEPS = ['Filters', 'Advanced', 'Results', 'Export'];

const KPI_META: Record<string, { label: string; unit: string; pct?: boolean }> = {
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
    if (v === null || v === undefined) return '—';
    return pct ? (v * 100).toFixed(3) + '%' : v.toFixed(4);
}

function ChipGroup({ options, selected, onChange }: {
    options: string[];
    selected: string[];
    onChange: (v: string[]) => void;
}) {
    const toggle = (val: string) => {
        onChange(selected.includes(val) ? selected.filter(s => s !== val) : [...selected, val]);
    };
    return (
        <div className="chip-group">
            {options.map(o => (
                <button key={o} type="button" className={`chip ${selected.includes(o) ? 'active' : ''}`} onClick={() => toggle(o)}>
                    {o}
                </button>
            ))}
        </div>
    );
}

function Stepper({ step }: { step: number }) {
    return (
        <div className="stepper">
            {STEPS.map((label, i) => (
                <div key={label} style={{ display: 'contents' }}>
                    <div className={`step ${i === step ? 'active' : i < step ? 'done' : ''}`}>
                        <div className="step-number">{i < step ? '✓' : i + 1}</div>
                        <span className="step-label">{label}</span>
                    </div>
                    {i < STEPS.length - 1 && <div className="step-line" />}
                </div>
            ))}
        </div>
    );
}

export default function WizardPage() {
    const [step, setStep] = useState(0);
    const [markets, setMarkets] = useState<string[]>([]);
    const [marketInput, setMarketInput] = useState('');
    const [objectives, setObjectives] = useState<string[]>([]);
    const [sectors, setSectors] = useState<string[]>([]);
    const [periodFrom, setPeriodFrom] = useState('');
    const [periodTo, setPeriodTo] = useState('');
    const [marginPct, setMarginPct] = useState(0);
    const [preset, setPreset] = useState<'Strict' | 'Normal' | 'Loose'>('Normal');
    const [minImpressions, setMinImpressions] = useState(1000);
    const [minSpend, setMinSpend] = useState(10);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [result, setResult] = useState<{ kpis: KpiOutput; filteredRows: number; totalRows: number } | null>(null);
    const [copied, setCopied] = useState(false);

    const addMarket = () => {
        const m = marketInput.trim().toUpperCase();
        if (m && !markets.includes(m)) setMarkets([...markets, m]);
        setMarketInput('');
    };

    const analyze = useCallback(async () => {
        setLoading(true); setError('');
        try {
            const res = await fetch('/api/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    filters: {
                        market: markets.length ? markets : undefined,
                        objective: objectives.length ? objectives : undefined,
                        sector: sectors.length ? sectors : undefined,
                        periodFrom: periodFrom || undefined,
                        periodTo: periodTo || undefined,
                    },
                    marginPct,
                    outlierPreset: preset,
                    minImpressions,
                    minSpend,
                }),
            });
            const data = await res.json();
            if (!res.ok) { setError(data.error ?? 'Analysis failed'); return; }
            setResult(data);
            setStep(2);
        } catch {
            setError('Network error, please retry.');
        } finally {
            setLoading(false);
        }
    }, [markets, objectives, sectors, periodFrom, periodTo, marginPct, preset, minImpressions, minSpend]);

    const copyToClipboard = useCallback(async () => {
        if (!result) return;
        const lines = ['KPI\tRaw\tAdjusted\tSample'];
        for (const [key, val] of Object.entries(result.kpis)) {
            const meta = KPI_META[key as string];
            if (!val || (val as KpiValue).raw === null) continue;
            lines.push([
                meta?.label ?? key,
                fmt((val as KpiValue).raw, meta?.pct),
                fmt((val as KpiValue).adjusted, meta?.pct),
                (val as KpiValue).sampleSize,
            ].join('\t'));
        }
        await navigator.clipboard.writeText(lines.join('\n'));
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
    }, [result]);

    const downloadCSV = useCallback(() => {
        if (!result) return;
        const lines = ['KPI,Raw,Adjusted,Sample,Excluded'];
        for (const [key, val] of Object.entries(result.kpis)) {
            const meta = KPI_META[key as string];
            if (!val || (val as KpiValue).raw === null) continue;
            lines.push([
                meta?.label ?? key,
                fmt((val as KpiValue).raw, meta?.pct),
                fmt((val as KpiValue).adjusted, meta?.pct),
                (val as KpiValue).sampleSize,
                (val as KpiValue).exclusionSummary.totalExcluded,
            ].join(','));
        }
        const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `kpi-benchmark-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click(); URL.revokeObjectURL(url);
    }, [result]);

    const reset = () => { setStep(0); setResult(null); setError(''); };

    return (
        <div style={{ minHeight: '100vh', padding: '24px' }}>
            {/* NAV */}
            <nav className="nav" style={{ marginBottom: '32px', borderRadius: 'var(--radius-md)' }}>
                <div className="nav-logo">🚀 Cosmic KPI Master</div>
                <div className="nav-links">
                    <a href="/api/auth/logout" className="btn btn-ghost btn-sm"
                        onClick={async (e) => { e.preventDefault(); await fetch('/api/auth/logout', { method: 'POST' }); window.location.href = '/login'; }}>
                        Sign out
                    </a>
                </div>
            </nav>

            <div style={{ maxWidth: '700px', margin: '0 auto' }}>
                <Stepper step={step} />

                {/* STEP 0: Filters */}
                {step === 0 && (
                    <div className="card">
                        <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '24px' }}>Set your filters</h2>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            <div className="form-group">
                                <label className="label">Market (ISO code, e.g. ES, IT)</label>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <input className="input" placeholder="ES" value={marketInput}
                                        onChange={e => setMarketInput(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addMarket())} />
                                    <button type="button" className="btn btn-ghost" onClick={addMarket}>Add</button>
                                </div>
                                {markets.length > 0 && (
                                    <div className="chip-group mt-2">
                                        {markets.map(m => (
                                            <button key={m} className="chip active" onClick={() => setMarkets(markets.filter(x => x !== m))}>
                                                {m} ×
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="form-group">
                                <label className="label">Objective <span style={{ color: 'var(--text-muted)' }}>(leave empty = all)</span></label>
                                <ChipGroup options={OBJECTIVES} selected={objectives} onChange={setObjectives} />
                            </div>

                            <div className="form-group">
                                <label className="label">Sector <span style={{ color: 'var(--text-muted)' }}>(leave empty = all)</span></label>
                                <ChipGroup options={SECTORS} selected={sectors} onChange={setSectors} />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <div className="form-group">
                                    <label className="label">Period from</label>
                                    <input className="input" type="month" value={periodFrom} onChange={e => setPeriodFrom(e.target.value)} />
                                </div>
                                <div className="form-group">
                                    <label className="label">Period to</label>
                                    <input className="input" type="month" value={periodTo} onChange={e => setPeriodTo(e.target.value)} />
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="label">Fee surplus / Margin %</label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <input className="input" type="range" min="0" max="50" step="1" value={marginPct}
                                        onChange={e => setMarginPct(Number(e.target.value))}
                                        style={{ flex: 1, accentColor: 'var(--accent)' }} />
                                    <span style={{ minWidth: '48px', fontWeight: 700, color: 'var(--accent)' }}>{marginPct}%</span>
                                </div>
                                <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                    Applied to cost KPIs (CPM, CPC, CPV, CPV6, CPSF). Ratios (CTR, ER, VTR6) are unchanged.
                                </p>
                            </div>
                        </div>

                        <div style={{ marginTop: '28px', display: 'flex', justifyContent: 'flex-end' }}>
                            <button className="btn btn-primary" onClick={() => setStep(1)}>Advanced settings →</button>
                        </div>
                    </div>
                )}

                {/* STEP 1: Advanced */}
                {step === 1 && (
                    <div className="card">
                        <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '24px' }}>Advanced settings</h2>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            <div className="form-group">
                                <label className="label">Outlier removal preset</label>
                                <div className="chip-group">
                                    {PRESETS.map(p => (
                                        <button key={p} type="button" className={`chip ${preset === p ? 'active' : ''}`} onClick={() => setPreset(p)}>{p}</button>
                                    ))}
                                </div>
                                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px' }}>
                                    Strict removes more outliers. Loose keeps more data. Normal is recommended.
                                </p>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <div className="form-group">
                                    <label className="label">Min impressions</label>
                                    <input className="input" type="number" min="0" value={minImpressions}
                                        onChange={e => setMinImpressions(Number(e.target.value))} />
                                </div>
                                <div className="form-group">
                                    <label className="label">Min spend (€)</label>
                                    <input className="input" type="number" min="0" value={minSpend}
                                        onChange={e => setMinSpend(Number(e.target.value))} />
                                </div>
                            </div>
                        </div>

                        {error && <div className="alert alert-error mt-4">⚠ {error}</div>}

                        <div style={{ marginTop: '28px', display: 'flex', justifyContent: 'space-between' }}>
                            <button className="btn btn-ghost" onClick={() => setStep(0)}>← Back</button>
                            <button className="btn btn-primary" onClick={analyze} disabled={loading}>
                                {loading ? 'Computing…' : 'Calculate KPIs →'}
                            </button>
                        </div>
                    </div>
                )}

                {/* STEP 2: Results */}
                {step === 2 && result && (
                    <div className="card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h2 style={{ fontSize: '18px', fontWeight: 700 }}>Benchmark Results</h2>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                    {result.filteredRows} rows matched of {result.totalRows} total
                                </span>
                            </div>
                        </div>

                        <table className="kpi-table">
                            <thead>
                                <tr>
                                    <th>KPI</th>
                                    <th>Raw avg</th>
                                    <th>Adjusted ({marginPct}% margin)</th>
                                    <th>Sample</th>
                                    <th>Excl.</th>
                                </tr>
                            </thead>
                            <tbody>
                                {Object.entries(result.kpis).map(([key, val]) => {
                                    const kv = val as KpiValue | undefined;
                                    if (!kv || kv.raw === null) return null;
                                    const meta = KPI_META[key];
                                    return (
                                        <tr key={key}>
                                            <td className="kpi-name">{meta?.label ?? key} <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: '11px' }}>{meta?.unit}</span></td>
                                            <td className="kpi-raw">{fmt(kv.raw, meta?.pct)}</td>
                                            <td className="kpi-adjusted">{fmt(kv.adjusted, meta?.pct)}</td>
                                            <td className="kpi-sample">{kv.sampleSize}</td>
                                            <td>
                                                {kv.exclusionSummary.totalExcluded > 0 && (
                                                    <span className="exclusion-badge">{kv.exclusionSummary.totalExcluded} excluded</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>

                        <div style={{ marginTop: '28px', display: 'flex', justifyContent: 'space-between' }}>
                            <button className="btn btn-ghost" onClick={() => setStep(1)}>← Adjust</button>
                            <button className="btn btn-primary" onClick={() => setStep(3)}>Export →</button>
                        </div>
                    </div>
                )}

                {/* STEP 3: Export */}
                {step === 3 && result && (
                    <div className="card">
                        <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '24px' }}>Export results</h2>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <button className="btn btn-primary btn-lg w-full" onClick={copyToClipboard}>
                                {copied ? '✓ Copied to clipboard!' : '📋 Copy KPIs to clipboard'}
                            </button>
                            <button className="btn btn-ghost btn-lg w-full" onClick={downloadCSV}>
                                ⬇ Download CSV
                            </button>
                        </div>

                        <div className="alert alert-info mt-4">
                            💡 Clipboard format is tab-separated — paste directly into Google Sheets or Excel.
                        </div>

                        <div style={{ marginTop: '28px', display: 'flex', justifyContent: 'space-between' }}>
                            <button className="btn btn-ghost" onClick={() => setStep(2)}>← Results</button>
                            <button className="btn btn-ghost" onClick={reset}>New analysis</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
