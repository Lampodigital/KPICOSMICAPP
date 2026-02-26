'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';

interface User { id: string; email: string; role: string; isActive: boolean; lastLoginAt?: string; createdAt: string; }
interface Config {
    dataFileName?: string;
    defaultOutlierPreset: string;
    defaultMinImpressions: number;
    defaultMinSpend: number;
    qualityPresetsOverrides?: any;
    badgeThresholdsOverrides?: any;
}

interface PresetThresholds {
    global: { minSpend: number; minImpressions: number };
    kpi: {
        CPM: { minImpressions: number };
        CPC: { minClicks: number };
        CTR: { minImpressions: number };
        CPV6: { minVideoViews6s: number };
        CVR: { minClicks: number };
    };
    iqrMultiplier: number;
    maxExcludedSpendPct: number;
}
interface BadgeThresholds {
    high: { minRows: number; minSpend: number; maxExcludedPct: number };
    medium: { minRows: number; minSpend: number; maxExcludedPct: number };
}

const CODE_PRESETS: Record<string, PresetThresholds> = {
    Conservative: {
        global: { minSpend: 20, minImpressions: 1500 },
        kpi: { CPC: { minClicks: 10 }, CPM: { minImpressions: 3000 }, CPV6: { minVideoViews6s: 100 }, CTR: { minImpressions: 3000 }, CVR: { minClicks: 50 } },
        iqrMultiplier: 2.0, maxExcludedSpendPct: 25,
    },
    Balanced: {
        global: { minSpend: 50, minImpressions: 5000 },
        kpi: { CPC: { minClicks: 20 }, CPM: { minImpressions: 10000 }, CPV6: { minVideoViews6s: 200 }, CTR: { minImpressions: 10000 }, CVR: { minClicks: 100 } },
        iqrMultiplier: 1.5, maxExcludedSpendPct: 30,
    },
    Strict: {
        global: { minSpend: 100, minImpressions: 10000 },
        kpi: { CPC: { minClicks: 50 }, CPM: { minImpressions: 25000 }, CPV6: { minVideoViews6s: 500 }, CTR: { minImpressions: 25000 }, CVR: { minClicks: 250 } },
        iqrMultiplier: 1.0, maxExcludedSpendPct: 40,
    },
};
const CODE_BADGE_DEFAULTS: BadgeThresholds = {
    high: { minRows: 30, minSpend: 2000, maxExcludedPct: 20 },
    medium: { minRows: 10, minSpend: 500, maxExcludedPct: 35 },
};

function deepClone<T>(x: T): T { return JSON.parse(JSON.stringify(x)); }

export default function AdminPage() {
    const [users, setUsers] = useState<User[]>([]);
    const [config, setConfig] = useState<Config | null>(null);
    const [tab, setTab] = useState<'users' | 'data' | 'defaults'>('data');
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState('');
    const [newUser, setNewUser] = useState({ email: '', password: '', role: 'MEMBER' });
    const fileRef = useRef<HTMLInputElement>(null);
    const [activePresetTab, setActivePresetTab] = useState<'Conservative' | 'Balanced' | 'Strict'>('Balanced');

    const [presets, setPresets] = useState<Record<string, PresetThresholds>>(deepClone(CODE_PRESETS));
    const [badges, setBadges] = useState<BadgeThresholds>(deepClone(CODE_BADGE_DEFAULTS));

    useEffect(() => {
        fetch('/api/admin/users').then(r => r.json()).then(d => setUsers(d.users ?? []));
        fetch('/api/admin/data-source').then(r => r.json()).then(d => {
            setConfig(d.config);
            if (d.config?.qualityPresetsOverrides) {
                setPresets({ ...deepClone(CODE_PRESETS), ...d.config.qualityPresetsOverrides });
            }
            if (d.config?.badgeThresholdsOverrides) {
                setBadges({ ...deepClone(CODE_BADGE_DEFAULTS), ...d.config.badgeThresholdsOverrides });
            }
        });
    }, []);

    const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 4000); };

    const uploadFile = async (file: File) => {
        setLoading(true);
        const fd = new FormData(); fd.append('file', file);
        const res = await fetch('/api/admin/data-source', { method: 'POST', body: fd });
        const data = await res.json();
        setLoading(false);
        if (res.ok) {
            setConfig(c => ({ ...(c ?? { defaultOutlierPreset: 'Balanced', defaultMinImpressions: 5000, defaultMinSpend: 50 }), dataFileName: data.fileName }));
            flash(`✓ Uploaded "${data.fileName}" — ${data.rowCount} rows detected`);
        } else {
            flash(`✗ ${data.error}`);
        }
    };

    const createUser = async () => {
        if (!newUser.email || !newUser.password) return;
        const res = await fetch('/api/admin/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newUser) });
        const data = await res.json();
        if (res.ok) {
            setUsers(u => [data.user, ...u]);
            setNewUser({ email: '', password: '', role: 'MEMBER' });
            flash(`✓ User ${data.user.email} created`);
        } else flash(`✗ ${data.error}`);
    };

    const updateUser = async (id: string, patch: Partial<User & { newPassword?: string }>) => {
        const res = await fetch('/api/admin/users', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...patch }) });
        const data = await res.json();
        if (res.ok) setUsers(u => u.map(x => x.id === id ? data.user : x));
    };

    const saveConfig = async () => {
        setLoading(true);
        try {
            const body: any = {
                defaultOutlierPreset: config?.defaultOutlierPreset,
                defaultMinImpressions: config?.defaultMinImpressions,
                defaultMinSpend: config?.defaultMinSpend,
                qualityPresetsOverrides: presets,
                badgeThresholdsOverrides: badges,
            };
            const res = await fetch('/api/admin/config', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const data = await res.json();
            if (res.ok) { setConfig(data.config); flash('✓ Global defaults saved'); }
            else flash(`✗ ${data.error}`);
        } catch (e: any) {
            flash(`✗ ${e.message}`);
        }
        setLoading(false);
    };

    const resetPresetToCode = (preset: string) => {
        setPresets(p => ({ ...p, [preset]: deepClone(CODE_PRESETS[preset]) }));
        flash(`✓ ${preset} reset to code defaults`);
    };

    const setP = (preset: string, updater: (t: PresetThresholds) => PresetThresholds) => {
        setPresets(p => ({ ...p, [preset]: updater(deepClone(p[preset])) }));
    };

    const numInput = (value: number, onChange: (v: number) => void, opts: { min?: number; max?: number; step?: number } = {}) => (
        <input
            className="input"
            type="number"
            value={value}
            min={opts.min ?? 0}
            max={opts.max}
            step={opts.step ?? 1}
            onChange={e => onChange(Number(e.target.value))}
            style={{ width: '120px', textAlign: 'right' }}
        />
    );

    const fieldRow = (label: string, hint: string, input: React.ReactNode) => (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0', borderBottom: '1px solid var(--border)' }}>
            <div style={{ maxWidth: '75%' }}>
                <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)' }}>{label}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>{hint}</div>
            </div>
            {input}
        </div>
    );

    const p = presets[activePresetTab];
    const codeP = CODE_PRESETS[activePresetTab];

    return (
        <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-base)' }}>
            <nav className="nav">
                <div className="nav-logo">
                    <img src="/brand/cosmic-logo-blue.png" alt="Cosmic Logo" style={{ width: '110px', height: '28px', objectFit: 'contain', filter: 'brightness(0) invert(1)' }} />
                    <span style={{ marginLeft: '12px', fontSize: '13px', color: 'var(--text-muted)', fontWeight: 500, paddingLeft: '12px', borderLeft: '1px solid var(--border)' }}>Admin Portal</span>
                </div>
                <div className="nav-links">
                    <Link href="/wizard" className="btn btn-ghost btn-sm">← Back to App</Link>
                    <a href="/api/auth/logout" className="btn btn-ghost btn-sm"
                        onClick={async (e) => { e.preventDefault(); await fetch('/api/auth/logout', { method: 'POST' }); window.location.href = '/login'; }}>
                        Sign out
                    </a>
                </div>
            </nav>

            <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px 32px' }}>
                <div style={{ marginBottom: '32px' }}>
                    <h1 style={{ fontSize: '28px', fontWeight: 900, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>System Administration</h1>
                    <p style={{ color: 'var(--text-muted)', marginTop: '4px', fontSize: '15px' }}>Configure data sources, user access, and KPI analysis defaults.</p>
                </div>

                {msg && <div className={`alert ${msg.startsWith('✓') ? 'alert-success' : 'alert-error'} mb-6`} style={{ maxWidth: '100%' }}>{msg}</div>}

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '24px' }}>

                    {/* Sidebar */}
                    <div className="card" style={{ gridColumn: 'span 3', alignSelf: 'start', padding: '24px' }}>
                        <h2 style={{ fontSize: '15px', fontWeight: 900, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '16px' }}>Settings</h2>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {(['data', 'users', 'defaults'] as const).map(t => (
                                <button key={t} className={`btn ${tab === t ? 'btn-primary' : 'btn-ghost'} w-full`} style={{ justifyContent: 'flex-start', padding: '10px 16px' }} onClick={() => setTab(t)}>
                                    {t === 'data' && '📄 Data Source'}
                                    {t === 'users' && '👥 User Access'}
                                    {t === 'defaults' && '⚙️ Global Defaults'}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* DATA SOURCE TAB */}
                    {tab === 'data' && (
                        <div className="card" style={{ gridColumn: 'span 9' }}>
                            <h2 style={{ fontSize: '20px', fontWeight: 900, marginBottom: '8px' }}>Data Source Management</h2>
                            <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '24px' }}>Upload the master Excel file. All members will query against this data.</p>
                            {config?.dataFileName && (
                                <div className="alert alert-success mb-6">✓ Active file: <strong>{config.dataFileName}</strong></div>
                            )}
                            <div className="upload-zone" style={{ padding: '64px', textAlign: 'center', backgroundColor: 'var(--bg-elevated)', border: '2px dashed var(--border)', borderRadius: 'var(--radius-md)', cursor: 'pointer', transition: 'all 200ms' }}
                                onClick={() => fileRef.current?.click()}
                                onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.backgroundColor = 'var(--accent-dim)'; }}
                                onDragLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.backgroundColor = 'var(--bg-elevated)'; }}
                                onDrop={async e => {
                                    e.preventDefault(); e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.backgroundColor = 'var(--bg-elevated)';
                                    const f = e.dataTransfer.files[0]; if (f) uploadFile(f);
                                }}>
                                <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) uploadFile(f); }} />
                                <div style={{ fontSize: '40px', marginBottom: '16px' }}>📊</div>
                                <p style={{ fontWeight: 600, fontSize: '18px', color: 'var(--text-primary)', marginBottom: '8px' }}>Drop your .xlsx file here</p>
                                <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>or click to browse your computer</p>
                                {loading && <p style={{ color: 'var(--accent)', marginTop: '16px', fontSize: '14px', fontWeight: 600 }}>Uploading & parsing…</p>}
                            </div>
                        </div>
                    )}

                    {/* USERS TAB */}
                    {tab === 'users' && (
                        <div className="card" style={{ gridColumn: 'span 9' }}>
                            <h2 style={{ fontSize: '20px', fontWeight: 900, marginBottom: '8px' }}>User Management</h2>
                            <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '24px' }}>Control who has access to the KPI Master platform.</p>
                            <div className="card-surface mb-8" style={{ border: '2px solid var(--border)' }}>
                                <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '16px' }}>Create new user</h3>
                                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(200px, 1fr) minmax(180px, 1fr) 140px auto', gap: '16px', alignItems: 'end' }}>
                                    <div className="form-group">
                                        <label className="label">Email address</label>
                                        <input className="input" type="email" placeholder="user@cosmic.tech" value={newUser.email} onChange={e => setNewUser(u => ({ ...u, email: e.target.value }))} />
                                    </div>
                                    <div className="form-group">
                                        <label className="label">Temporary password</label>
                                        <input className="input" type="password" placeholder="Minimum 8 chars" value={newUser.password} onChange={e => setNewUser(u => ({ ...u, password: e.target.value }))} />
                                    </div>
                                    <div className="form-group">
                                        <label className="label">Role</label>
                                        <select className="input" style={{ width: '100%', WebkitAppearance: 'none' }} value={newUser.role} onChange={e => setNewUser(u => ({ ...u, role: e.target.value }))}>
                                            <option value="MEMBER">Member</option>
                                            <option value="ADMIN">Admin</option>
                                        </select>
                                    </div>
                                    <button className="btn btn-primary" style={{ padding: '12px 24px' }} onClick={createUser}>Create</button>
                                </div>
                            </div>
                            <div style={{ overflowX: 'auto', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                                    <thead style={{ background: 'var(--bg-elevated)' }}>
                                        <tr>
                                            {['Email', 'Role', 'Status', 'Last login', 'Actions'].map(h => (
                                                <th key={h} style={{ textAlign: 'left', padding: '14px 16px', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid var(--border)' }}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody style={{ background: 'var(--bg-surface)' }}>
                                        {users.map(u => (
                                            <tr key={u.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                                <td style={{ padding: '16px', fontWeight: 500, color: 'var(--text-primary)' }}>{u.email}</td>
                                                <td style={{ padding: '16px' }}><span className={`badge ${u.role === 'ADMIN' ? 'active' : ''}`} style={{ backgroundColor: u.role === 'ADMIN' ? 'var(--accent-dim)' : 'var(--border)', color: u.role === 'ADMIN' ? 'var(--accent)' : 'var(--text-secondary)' }}>{u.role}</span></td>
                                                <td style={{ padding: '16px' }}><span style={{ color: u.isActive ? '#10B981' : '#EF4444', fontWeight: 600 }}>{u.isActive ? 'Active' : 'Disabled'}</span></td>
                                                <td style={{ padding: '16px', color: 'var(--text-muted)' }}>{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : 'Never'}</td>
                                                <td style={{ padding: '16px' }}>
                                                    <div style={{ display: 'flex', gap: '8px' }}>
                                                        <button className="btn btn-ghost btn-sm" style={{ padding: '6px 12px' }} onClick={() => updateUser(u.id, { isActive: !u.isActive })}>{u.isActive ? 'Disable' : 'Enable'}</button>
                                                        {u.role === 'MEMBER' && <button className="btn btn-ghost btn-sm" style={{ padding: '6px 12px', color: 'var(--accent)' }} onClick={() => updateUser(u.id, { role: 'ADMIN' })}>Make Admin</button>}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* DEFAULTS TAB */}
                    {tab === 'defaults' && config && (
                        <div style={{ gridColumn: 'span 9', display: 'flex', flexDirection: 'column', gap: '24px' }}>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <h2 style={{ fontSize: '20px', fontWeight: 900, color: 'var(--text-primary)' }}>Global Defaults & Overrides</h2>
                                    <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginTop: '4px' }}>Fine-tune how KPIs are filtered and how reliability is scored.</p>
                                </div>
                                <button className="btn btn-primary" onClick={saveConfig} disabled={loading} style={{ padding: '12px 28px' }}>
                                    {loading ? 'Saving...' : '💾 Save All Changes'}
                                </button>
                            </div>

                            {/* Default Preset */}
                            <div className="card" style={{ padding: '24px' }}>
                                <h3 style={{ fontWeight: 800, fontSize: '16px', marginBottom: '4px' }}>Default Preset</h3>
                                <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px' }}>Which preset is pre-selected when users open the wizard.</p>
                                <div style={{ display: 'flex', gap: '12px' }}>
                                    {(['Conservative', 'Balanced', 'Strict'] as const).map(name => (
                                        <button
                                            key={name}
                                            className={`btn ${config.defaultOutlierPreset === name ? 'btn-primary' : 'btn-ghost'}`}
                                            style={{ flex: 1, padding: '14px' }}
                                            onClick={() => setConfig({ ...config, defaultOutlierPreset: name })}
                                        >
                                            {name === 'Conservative' ? '🛡️ ' : name === 'Balanced' ? '⚖️ ' : '🔬 '}{name}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Per-Preset Threshold Editor */}
                            <div className="card" style={{ padding: '24px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                                    <div>
                                        <h3 style={{ fontWeight: 800, fontSize: '16px', marginBottom: '4px' }}>Quality Filter Thresholds</h3>
                                        <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Minimum data requirements per campaign row before it enters analysis.</p>
                                    </div>
                                    <button className="btn btn-ghost btn-sm" onClick={() => resetPresetToCode(activePresetTab)} style={{ fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                                        ↩ Reset {activePresetTab}
                                    </button>
                                </div>

                                {/* Preset Tab Switcher */}
                                <div style={{ display: 'flex', gap: '4px', marginBottom: '28px', background: 'var(--bg-elevated)', padding: '4px', borderRadius: 'var(--radius-sm)', width: 'fit-content' }}>
                                    {(['Conservative', 'Balanced', 'Strict'] as const).map(name => (
                                        <button
                                            key={name}
                                            onClick={() => setActivePresetTab(name)}
                                            style={{
                                                padding: '8px 22px', borderRadius: 'calc(var(--radius-sm) - 2px)', border: 'none',
                                                background: activePresetTab === name ? 'var(--bg-surface)' : 'transparent',
                                                color: activePresetTab === name ? 'var(--text-primary)' : 'var(--text-muted)',
                                                fontWeight: activePresetTab === name ? 700 : 500,
                                                fontSize: '13px', cursor: 'pointer', transition: 'all 150ms',
                                                boxShadow: activePresetTab === name ? 'var(--shadow-sm)' : 'none',
                                            }}
                                        >{name}</button>
                                    ))}
                                </div>

                                {p && codeP && (
                                    <div>
                                        {/* Global */}
                                        <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', marginBottom: '4px' }}>🌍 Global Row Filters</div>
                                        {fieldRow('Min Spend per Row (€)', `Rows below this spend are dropped entirely. Code default: €${codeP.global.minSpend}`,
                                            numInput(p.global.minSpend, v => setP(activePresetTab, t => { t.global.minSpend = v; return t; }), { min: 0, step: 5 }))}
                                        {fieldRow('Min Impressions per Row', `Rows with fewer impressions are excluded. Code default: ${codeP.global.minImpressions.toLocaleString()}`,
                                            numInput(p.global.minImpressions, v => setP(activePresetTab, t => { t.global.minImpressions = v; return t; }), { min: 0, step: 100 }))}

                                        {/* KPI-Specific */}
                                        <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', marginTop: '24px', marginBottom: '4px' }}>📊 KPI-Specific Minimums</div>
                                        {fieldRow('CPM – Min Impressions', `Rows must meet this to count for CPM. Code default: ${codeP.kpi.CPM.minImpressions.toLocaleString()}`,
                                            numInput(p.kpi.CPM.minImpressions, v => setP(activePresetTab, t => { t.kpi.CPM.minImpressions = v; return t; }), { min: 0, step: 500 }))}
                                        {fieldRow('CPC – Min Clicks', `Rows must meet this to count for CPC. Code default: ${codeP.kpi.CPC.minClicks}`,
                                            numInput(p.kpi.CPC.minClicks, v => setP(activePresetTab, t => { t.kpi.CPC.minClicks = v; return t; }), { min: 0, step: 5 }))}
                                        {fieldRow('CTR – Min Impressions', `Rows must meet this to count for CTR. Code default: ${codeP.kpi.CTR.minImpressions.toLocaleString()}`,
                                            numInput(p.kpi.CTR.minImpressions, v => setP(activePresetTab, t => { t.kpi.CTR.minImpressions = v; return t; }), { min: 0, step: 500 }))}
                                        {fieldRow('CPV6 – Min 6s Views', `Rows must meet this to count for CPV6. Code default: ${codeP.kpi.CPV6.minVideoViews6s}`,
                                            numInput(p.kpi.CPV6.minVideoViews6s, v => setP(activePresetTab, t => { t.kpi.CPV6.minVideoViews6s = v; return t; }), { min: 0, step: 10 }))}
                                        {fieldRow('CVR – Min Clicks', `Conversion Rate is calculated on rows with enough clicks. Code default: ${codeP.kpi.CVR.minClicks}`,
                                            numInput(p.kpi.CVR.minClicks, v => setP(activePresetTab, t => { t.kpi.CVR.minClicks = v; return t; }), { min: 0, step: 10 }))}

                                        {/* Outlier Detection */}
                                        <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', marginTop: '24px', marginBottom: '4px' }}>📐 Outlier Detection</div>
                                        {fieldRow('IQR Multiplier', `Sensitivity of outlier removal. Lower = more aggressive. Code default: ${codeP.iqrMultiplier}×  (range: 0.5–3.0)`,
                                            numInput(p.iqrMultiplier, v => setP(activePresetTab, t => { t.iqrMultiplier = v; return t; }), { min: 0.5, max: 3, step: 0.1 }))}
                                        {fieldRow('Max Excluded Spend %', `If more spend than this is dropped, a warning is shown. Code default: ${codeP.maxExcludedSpendPct}%`,
                                            numInput(p.maxExcludedSpendPct, v => setP(activePresetTab, t => { t.maxExcludedSpendPct = v; return t; }), { min: 0, max: 100, step: 5 }))}
                                    </div>
                                )}
                            </div>

                            {/* Reliability Badge Thresholds */}
                            <div className="card" style={{ padding: '24px' }}>
                                <h3 style={{ fontWeight: 800, fontSize: '16px', marginBottom: '4px' }}>Reliability Badge Thresholds</h3>
                                <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '24px' }}>Define when a KPI result is considered "High", "Medium", or "Low" reliability. Anything below Medium is shown as "Low".</p>

                                {(['high', 'medium'] as const).map(tier => (
                                    <div key={tier} style={{ marginBottom: tier === 'high' ? '32px' : 0 }}>
                                        <div style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: tier === 'high' ? '#10B981' : '#F59E0B', marginBottom: '4px' }}>
                                            {tier === 'high' ? '🟢 High Reliability' : '🟡 Medium Reliability (minimum boundary)'}
                                        </div>
                                        {fieldRow('Min Rows (campaigns)', `Code default: ${CODE_BADGE_DEFAULTS[tier].minRows} rows.`,
                                            numInput(badges[tier].minRows, v => setBadges(b => ({ ...b, [tier]: { ...b[tier], minRows: v } })), { min: 1, step: 5 }))}
                                        {fieldRow('Min Total Spend (€)', `Code default: €${CODE_BADGE_DEFAULTS[tier].minSpend.toLocaleString()}.`,
                                            numInput(badges[tier].minSpend, v => setBadges(b => ({ ...b, [tier]: { ...b[tier], minSpend: v } })), { min: 0, step: 100 }))}
                                        {fieldRow('Max Excluded Spend %', `Code default: ${CODE_BADGE_DEFAULTS[tier].maxExcludedPct}%. Above this, reliability is downgraded.`,
                                            numInput(badges[tier].maxExcludedPct, v => setBadges(b => ({ ...b, [tier]: { ...b[tier], maxExcludedPct: v } })), { min: 0, max: 100, step: 5 }))}
                                    </div>
                                ))}
                            </div>

                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
