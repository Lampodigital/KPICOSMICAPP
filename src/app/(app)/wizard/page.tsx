'use client';
import { useState, useCallback } from 'react';

import { KpiOutput, KpiValue } from '@/lib/kpis/registry';

const OBJECTIVES = ['Reach', 'Traffic', 'Video Views', 'Community Interaction', 'Lead Generation', 'App Promotion', 'Sales', 'Branded Mission'];
const SECTORS = ['Fashion', 'Beauty', 'Luxury', 'FMCG', 'Retail', 'App & Services', 'Education', 'Entertainment', 'Tech & Finance', 'Automotive', 'Travel'];
const MARKETS = ['IT', 'ES', 'FR', 'DE', 'UK', 'US', 'NL', 'BE', 'PL', 'PT', 'CH', 'AT', 'SE', 'DK', 'AE', 'SA', 'BR', 'MX'];
const PRESETS = ['Conservative', 'Balanced', 'Strict'] as const;

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

const REASON_DESCRIPTIONS: Record<string, { label: string; description: string }> = {
    BELOW_MIN_SPEND: {
        label: 'Low Spend',
        description: 'This campaign spent too little to generate reliable data.',
    },
    BELOW_MIN_IMPRESSIONS: {
        label: 'Low Impressions',
        description: 'This campaign had too few ad views to be statistically meaningful.',
    },
    BELOW_MIN_DENOMINATOR: {
        label: 'Insufficient Activity',
        description: 'This campaign didn\'t have enough clicks, views, or relevant events for this KPI.',
    },
    OUTSIDE_IQR_RANGE: {
        label: 'Statistical Outlier',
        description: 'This campaign\'s result was unusually high or low compared to similar campaigns — likely an anomaly.',
    },
};

function fmt(v: number | null | undefined, unit?: string, pct?: boolean): string {
    if (v === null || v === undefined) return '—';

    if (unit === '€') {
        return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(v);
    }

    if (pct) {
        // Percentage typically rendered with 3 decimals max
        return new Intl.NumberFormat('it-IT', {
            style: 'percent',
            minimumFractionDigits: 2,
            maximumFractionDigits: 3
        }).format(v); // passing v where v is e.g. 0.05 for 5%
    }

    return new Intl.NumberFormat('it-IT', {
        maximumFractionDigits: 4
    }).format(v);
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
    const [preset, setPreset] = useState<'Conservative' | 'Balanced' | 'Strict'>('Balanced');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [result, setResult] = useState<{ kpis: KpiOutput; filteredRows: number; totalRows: number } | null>(null);
    const [copied, setCopied] = useState(false);
    const [selectedKpiForExclusions, setSelectedKpiForExclusions] = useState<string | null>(null);

    const addCustomMarket = () => {
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
    }, [markets, objectives, sectors, periodFrom, periodTo, marginPct, preset]);

    const copyToClipboard = useCallback(async () => {
        if (!result) return;
        const lines = ['KPI\tRaw\tAdjusted'];
        for (const [key, val] of Object.entries(result.kpis)) {
            const meta = KPI_META[key as string];
            if (!val || (val as KpiValue).raw === null) continue;
            lines.push([
                meta?.label ?? key,
                fmt((val as KpiValue).raw, meta?.unit, meta?.pct),
                fmt((val as KpiValue).adjusted, meta?.unit, meta?.pct),
            ].join('\t'));
        }
        await navigator.clipboard.writeText(lines.join('\n'));
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
    }, [result]);

    const downloadCSV = useCallback(() => {
        if (!result) return;
        const lines = ['KPI,Raw,Adjusted'];
        for (const [key, val] of Object.entries(result.kpis)) {
            const meta = KPI_META[key as string];
            if (!val || (val as KpiValue).raw === null) continue;
            lines.push([
                meta?.label ?? key,
                fmt((val as KpiValue).raw, meta?.unit, meta?.pct),
                fmt((val as KpiValue).adjusted, meta?.unit, meta?.pct),
            ].join(','));
        }
        const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `kpi-benchmark-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click(); URL.revokeObjectURL(url);
    }, [result]);

    const reset = () => { setStep(0); setResult(null); setError(''); setSelectedKpiForExclusions(null); };

    return (
        <div style={{ minHeight: '100vh', background: 'transparent' }}>
            {/* NAV header */}
            <nav className="nav">
                <div className="nav-logo">
                    <img src="/brand/cosmic-logo-blue.png" alt="Cosmic Logo" style={{ width: '110px', height: '28px', objectFit: 'contain', filter: 'brightness(0) invert(1)' }} />
                    <span style={{ marginLeft: '12px', fontSize: '13px', color: 'var(--text-muted)', fontWeight: 500, paddingLeft: '12px', borderLeft: '1px solid var(--border)' }}>Dashboard</span>
                </div>
                <div className="nav-links">
                    <a href="/api/auth/logout" className="btn btn-ghost btn-sm"
                        onClick={async (e) => { e.preventDefault(); await fetch('/api/auth/logout', { method: 'POST' }); window.location.href = '/login'; }}>
                        Sign out
                    </a>
                </div>
            </nav>

            <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px 32px' }}>
                {/* Header Profile Actions */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                    <div>
                        <h1 style={{ fontSize: '36px', fontWeight: 900, letterSpacing: '-0.02em', background: 'linear-gradient(90deg, #FFF, var(--text-muted))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', filter: 'drop-shadow(0 0 20px rgba(255,255,255,0.1))' }}>KPI Benchmark Engine</h1>
                        <p style={{ color: 'var(--text-secondary)', marginTop: '8px', fontSize: '15px' }}>Configure your parameters and calculate real-time benchmarks.</p>
                    </div>
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <button className="btn btn-ghost" onClick={reset}>Reset Filters</button>
                        <button className="btn btn-primary" onClick={analyze} disabled={loading} style={{ padding: '12px 28px', fontSize: '15px' }}>
                            {loading ? 'Computing…' : 'Calculate KPIs ✨'}
                        </button>
                    </div>
                </div>

                {error && <div className="alert alert-error mb-6">⚠ {error}</div>}

                {/* Dashboard Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '24px' }}>

                    {/* Main Target Card */}
                    <div className="card" style={{ gridColumn: 'span 8', background: 'var(--bg-glass)', backdropFilter: 'blur(12px)' }}>
                        <h2 style={{ fontSize: '18px', fontWeight: 900, marginBottom: '24px' }}>Targeting & Positioning</h2>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                            <div className="form-group">
                                <label className="label">Markets <span style={{ color: 'var(--text-muted)', fontSize: '12px', fontWeight: 400 }}>(All if empty)</span></label>
                                <ChipGroup options={MARKETS} selected={markets} onChange={setMarkets} />
                                {/* Custom market input for codes not in the preset list */}
                                <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                                    <input
                                        className="input"
                                        placeholder="Add custom market (ISO code)…"
                                        value={marketInput}
                                        onChange={e => setMarketInput(e.target.value.toUpperCase())}
                                        onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addCustomMarket())}
                                        style={{ maxWidth: '260px', fontSize: '13px' }}
                                    />
                                    <button type="button" className="btn btn-ghost btn-sm" onClick={addCustomMarket} style={{ whiteSpace: 'nowrap' }}>+ Add</button>
                                </div>
                                {/* Show chips for custom markets not in the preset list */}
                                {markets.filter(m => !MARKETS.includes(m)).length > 0 && (
                                    <div className="chip-group mt-3">
                                        {markets.filter(m => !MARKETS.includes(m)).map(m => (
                                            <button key={m} className="chip active" onClick={() => setMarkets(markets.filter(x => x !== m))}>
                                                {m} ✕
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="form-group">
                                <label className="label">Objectives <span style={{ color: 'var(--text-muted)', fontSize: '12px', fontWeight: 400 }}>(All if empty)</span></label>
                                <ChipGroup options={OBJECTIVES} selected={objectives} onChange={setObjectives} />
                            </div>

                            <div className="form-group">
                                <label className="label">Sectors <span style={{ color: 'var(--text-muted)', fontSize: '12px', fontWeight: 400 }}>(All if empty)</span></label>
                                <ChipGroup options={SECTORS} selected={sectors} onChange={setSectors} />
                            </div>
                        </div>
                    </div>

                    {/* Secondary Cards Column */}
                    <div style={{ gridColumn: 'span 4', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                        {/* Timeframe Card */}
                        <div className="card" style={{ background: 'var(--bg-glass)', backdropFilter: 'blur(12px)' }}>
                            <h2 style={{ fontSize: '18px', fontWeight: 900, marginBottom: '24px' }}>Timeframe</h2>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <div className="form-group">
                                    <label className="label">Period from</label>
                                    <input className="input" type="month" value={periodFrom} onChange={e => setPeriodFrom(e.target.value)} />
                                </div>
                                <div className="form-group">
                                    <label className="label">Period to</label>
                                    <input className="input" type="month" value={periodTo} onChange={e => setPeriodTo(e.target.value)} />
                                </div>
                            </div>
                        </div>

                        {/* Adjustments Card */}
                        <div className="card" style={{ background: 'var(--bg-glass)', backdropFilter: 'blur(12px)' }}>
                            <h2 style={{ fontSize: '18px', fontWeight: 900, marginBottom: '24px' }}>Adjustments</h2>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                                <div className="form-group">
                                    <label className="label">Cosmic Margin %</label>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <input className="input" type="range" min="0" max="99" step="1" value={marginPct}
                                            onChange={e => setMarginPct(Number(e.target.value))}
                                            style={{ flex: 1, accentColor: 'var(--accent)', cursor: 'pointer' }} />
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <input
                                                type="number"
                                                min={0} max={99} step={1}
                                                value={marginPct}
                                                onChange={e => setMarginPct(Math.min(99, Math.max(0, Number(e.target.value))))}
                                                style={{
                                                    width: '60px', textAlign: 'right', padding: '6px 8px',
                                                    background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                                                    borderRadius: 'var(--radius-sm)', color: 'var(--accent)',
                                                    fontSize: '18px', fontWeight: 700, outline: 'none',
                                                }}
                                            />
                                            <span style={{ fontWeight: 700, color: 'var(--accent)', fontSize: '18px' }}>%</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Advanced Rules Row */}
                    <div className="card" style={{ gridColumn: 'span 12' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '32px' }}>
                            <div className="form-group" style={{ gridColumn: 'span 3' }}>
                                <label className="label">Data Quality & Exclusions (Guardrails)</label>
                                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                                    Adjusts baseline thresholds (min spend, min rows) and IQR aggressiveness. Default is Balanced.
                                </p>
                                <div className="chip-group mt-1">
                                    {PRESETS.map(p => (
                                        <button key={p} type="button" className={`chip ${preset === p ? 'active' : ''}`} onClick={() => setPreset(p)}>{p}</button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Results Area */}
                    {result && (
                        <div className="card" style={{ gridColumn: 'span 12', borderColor: 'var(--accent)', boxShadow: '0 0 60px var(--accent-dim)', background: 'var(--bg-glass)', backdropFilter: 'blur(16px)', position: 'relative', overflow: 'hidden' }}>
                            <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '4px', background: 'var(--accent)' }} />

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
                                <div>
                                    <h2 style={{ fontSize: '22px', fontWeight: 900, color: 'var(--text-primary)' }}>Benchmark Results</h2>
                                    <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>
                                        Analyzed <strong style={{ color: 'var(--text-primary)' }}>{result.filteredRows}</strong> relevant campaigns out of {result.totalRows} total data points.
                                    </p>
                                    <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '6px' }}>
                                        Filtering preset: <strong>{preset}</strong>
                                    </p>
                                </div>
                                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                    <details style={{ marginRight: '16px', fontSize: '13px', color: 'var(--text-muted)' }}>
                                        <summary style={{ cursor: 'pointer', fontWeight: 600 }}>How is this calculated?</summary>
                                        <ul style={{ paddingLeft: '20px', marginTop: '8px', lineHeight: '1.5' }}>
                                            <li>Global minimum thresholds applied.</li>
                                            <li>KPI-specific denominator drops low-signal rows.</li>
                                            <li>IQR exclusion removes statistical anomalies.</li>
                                        </ul>
                                    </details>
                                    <button className="btn btn-ghost" onClick={downloadCSV}>⬇ Export CSV</button>
                                    <button className="btn btn-primary" onClick={copyToClipboard}>
                                        {copied ? '✓ Copied!' : '📋 Copy to Clipboard'}
                                    </button>
                                </div>
                            </div>

                            <div style={{ overflowX: 'auto' }}>
                                <table className="kpi-table" style={{ width: '100%' }}>
                                    <thead>
                                        <tr>
                                            <th>Key Performance Indicator</th>
                                            <th>Reliability</th>
                                            <th>Raw Average</th>
                                            <th>Cosmic Adjusted (+{marginPct}%)</th>
                                            <th>Sample Size</th>
                                            <th>Data Excluded</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {Object.entries(result.kpis).map(([key, val]) => {
                                            const kv = val as KpiValue | undefined;
                                            if (!kv || (!kv.raw && kv.reliability === 'Unavailable')) return null;
                                            const meta = KPI_META[key];

                                            const getBadgeStyle = (b: string) => {
                                                if (b === 'High') return 'badge-success';
                                                if (b === 'Medium') return 'badge-warning';
                                                if (b === 'Low' || b === 'Unavailable') return 'badge-error';
                                                return '';
                                            };

                                            // Progressive disclosure: If unavailable, obscure the numbers
                                            const isUndef = kv.raw === null || kv.reliability === 'Unavailable';

                                            return (
                                                <tr key={key}>
                                                    <td className="kpi-name" style={{ fontSize: '15px' }}>{meta?.label ?? key} <span style={{ color: 'var(--text-muted)', fontWeight: 400, marginLeft: '6px' }}>{meta?.unit}</span></td>
                                                    <td>
                                                        <span className={`badge ${getBadgeStyle(kv.reliability)}`} style={{ padding: '4px 8px', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                                            {kv.reliability}
                                                        </span>
                                                    </td>
                                                    <td className="kpi-raw" style={{ fontSize: '15px', color: isUndef ? 'var(--text-muted)' : 'inherit' }}>
                                                        {isUndef ? 'Unavailable' : fmt(kv.raw, meta?.unit, meta?.pct)}
                                                    </td>
                                                    <td className="kpi-adjusted" style={{ fontSize: '16px', color: isUndef ? 'var(--text-muted)' : 'inherit' }}>
                                                        {isUndef ? 'Unavailable' : fmt(kv.adjusted, meta?.unit, meta?.pct)}
                                                    </td>
                                                    <td className="kpi-sample">
                                                        {isUndef ? '—' : `${kv.sampleSize} rows`}
                                                    </td>
                                                    <td>
                                                        {kv.exclusionSummary.totalExcluded > 0 ? (
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                                <span className="exclusion-badge">{kv.exclusionSummary.totalExcluded} dropped</span>
                                                                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{kv.exclusionSummary.excludedSpendPct.toFixed(1)}% spend</span>
                                                                <button
                                                                    className="btn btn-ghost"
                                                                    style={{ fontSize: '10px', padding: '2px 6px', marginTop: '4px' }}
                                                                    onClick={() => setSelectedKpiForExclusions(key)}
                                                                >
                                                                    View Details
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>—</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>

                {/* Exclusions Modal */}
                {selectedKpiForExclusions && result?.kpis[selectedKpiForExclusions as keyof KpiOutput] && (
                    <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px' }}>
                        <div className="card" style={{ width: '100%', maxWidth: '1200px', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', background: 'var(--bg)', boxShadow: '0 40px 100px rgba(0,0,0,0.5)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                                <div>
                                    <h2 style={{ fontSize: '22px', fontWeight: 700 }}>{KPI_META[selectedKpiForExclusions]?.label || selectedKpiForExclusions} Exclusions (Top 50 by Spend)</h2>
                                </div>
                                <button className="btn btn-ghost" onClick={() => setSelectedKpiForExclusions(null)}>✕ Close</button>
                            </div>
                            <div style={{ overflowY: 'auto', flex: 1, paddingBottom: '24px' }}>
                                <table className="kpi-table" style={{ width: '100%' }}>
                                    <thead>
                                        <tr>
                                            <th>Campaign</th>
                                            <th>Market</th>
                                            <th>Objective</th>
                                            <th>Spend (€)</th>
                                            <th>Impressions</th>
                                            <th>Clicks</th>
                                            <th>Computed Metric</th>
                                            <th>Reasons</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(result.kpis[selectedKpiForExclusions as keyof KpiOutput] as KpiValue).exclusionSummary.topExcluded?.map((ex, i) => (
                                            <tr key={i}>
                                                <td style={{ fontSize: '12px' }}>{ex.campaignName}</td>
                                                <td style={{ fontSize: '12px' }}>{ex.market}</td>
                                                <td style={{ fontSize: '12px' }}>{ex.objective}</td>
                                                <td style={{ fontSize: '12px' }}>{fmt(ex.spend, '€', false)}</td>
                                                <td style={{ fontSize: '12px' }}>{ex.impressions}</td>
                                                <td style={{ fontSize: '12px' }}>{ex.clicks}</td>
                                                <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{fmt(ex.computedValue, KPI_META[selectedKpiForExclusions]?.unit, KPI_META[selectedKpiForExclusions]?.pct)}</td>
                                                <td>
                                                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                                        {ex.reasons.map(r => {
                                                            const info = REASON_DESCRIPTIONS[r];
                                                            return (
                                                                <div key={r} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                                    <span style={{ padding: '2px 6px', background: 'var(--bg-glass)', borderRadius: '4px', fontSize: '10px', color: 'var(--text-warning)', fontWeight: 600, display: 'inline-block' }}>
                                                                        {info?.label ?? r}
                                                                    </span>
                                                                    {info?.description && (
                                                                        <span style={{ fontSize: '10px', color: 'var(--text-muted)', lineHeight: '1.3', maxWidth: '180px' }}>
                                                                            {info.description}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
