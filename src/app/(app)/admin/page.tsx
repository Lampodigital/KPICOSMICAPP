'use client';
import { useState, useEffect, useRef } from 'react';

interface User { id: string; email: string; role: string; isActive: boolean; lastLoginAt?: string; createdAt: string; }
interface Config { dataFileName?: string; defaultOutlierPreset: string; defaultMinImpressions: number; defaultMinSpend: number; }

export default function AdminPage() {
    const [users, setUsers] = useState<User[]>([]);
    const [config, setConfig] = useState<Config | null>(null);
    const [tab, setTab] = useState<'users' | 'data' | 'defaults'>('data');
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState('');
    const [newUser, setNewUser] = useState({ email: '', password: '', role: 'MEMBER' });
    const fileRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        fetch('/api/admin/users').then(r => r.json()).then(d => setUsers(d.users ?? []));
        fetch('/api/admin/data-source').then(r => r.json()).then(d => setConfig(d.config));
    }, []);

    const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 3000); };

    const uploadFile = async (file: File) => {
        setLoading(true);
        const fd = new FormData(); fd.append('file', file);
        const res = await fetch('/api/admin/data-source', { method: 'POST', body: fd });
        const data = await res.json();
        setLoading(false);
        if (res.ok) {
            setConfig(c => ({ ...(c ?? { defaultOutlierPreset: 'Normal', defaultMinImpressions: 1000, defaultMinSpend: 10 }), dataFileName: data.fileName }));
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

    return (
        <div style={{ minHeight: '100vh', padding: '24px' }}>
            <nav className="nav" style={{ marginBottom: '32px', borderRadius: 'var(--radius-md)' }}>
                <div className="nav-logo">🚀 Cosmic KPI Master <span style={{ fontSize: '11px', color: 'var(--accent)', marginLeft: '8px', fontWeight: 500 }}>Admin</span></div>
                <div className="nav-links">
                    <a href="/wizard" className="nav-link">Wizard</a>
                    <button className="btn btn-ghost btn-sm"
                        onClick={async () => { await fetch('/api/auth/logout', { method: 'POST' }); window.location.href = '/login'; }}>
                        Sign out
                    </button>
                </div>
            </nav>

            {msg && <div className={`alert ${msg.startsWith('✓') ? 'alert-success' : 'alert-error'} mb-4`} style={{ maxWidth: 800, margin: '0 auto 16px' }}>{msg}</div>}

            <div style={{ maxWidth: '800px', margin: '0 auto' }}>
                {/* Tab bar */}
                <div className="card-surface flex gap-2 mb-6 p-2" style={{ display: 'flex', gap: '6px' }}>
                    {(['data', 'users', 'defaults'] as const).map(t => (
                        <button key={t} className={`btn ${tab === t ? 'btn-primary' : 'btn-ghost'} btn-sm`} onClick={() => setTab(t)}>
                            {t === 'data' ? '📄 Data Source' : t === 'users' ? '👥 Users' : '⚙️ Defaults'}
                        </button>
                    ))}
                </div>

                {/* DATA SOURCE TAB */}
                {tab === 'data' && (
                    <div className="card">
                        <h2 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px' }}>Data Source</h2>
                        {config?.dataFileName && (
                            <div className="alert alert-success mb-4">✓ Active file: <strong>{config.dataFileName}</strong></div>
                        )}
                        <div className="upload-zone"
                            onClick={() => fileRef.current?.click()}
                            onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('drag-over'); }}
                            onDragLeave={e => e.currentTarget.classList.remove('drag-over')}
                            onDrop={async e => {
                                e.preventDefault(); e.currentTarget.classList.remove('drag-over');
                                const f = e.dataTransfer.files[0];
                                if (f) uploadFile(f);
                            }}>
                            <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={e => { const f = e.target.files?.[0]; if (f) uploadFile(f); }} />
                            <div style={{ fontSize: '32px', marginBottom: '12px' }}>📊</div>
                            <p style={{ fontWeight: 600, marginBottom: '4px' }}>Drop your .xlsx file here</p>
                            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>or click to browse</p>
                            {loading && <p style={{ color: 'var(--accent)', marginTop: '8px', fontSize: '13px' }}>Uploading…</p>}
                        </div>
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '12px' }}>
                            Only Admins can change the data source. Members access results only through the wizard.
                        </p>
                    </div>
                )}

                {/* USERS TAB */}
                {tab === 'users' && (
                    <div className="card">
                        <h2 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px' }}>Users</h2>

                        {/* Create user */}
                        <div className="card-surface mb-6">
                            <h3 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '12px' }}>Create new user</h3>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto auto', gap: '10px', alignItems: 'end' }}>
                                <div className="form-group">
                                    <label className="label">Email</label>
                                    <input className="input" type="email" placeholder="user@cosmic.tech" value={newUser.email} onChange={e => setNewUser(u => ({ ...u, email: e.target.value }))} />
                                </div>
                                <div className="form-group">
                                    <label className="label">Temp password</label>
                                    <input className="input" type="password" placeholder="Minimum 8 chars" value={newUser.password} onChange={e => setNewUser(u => ({ ...u, password: e.target.value }))} />
                                </div>
                                <div className="form-group">
                                    <label className="label">Role</label>
                                    <select className="input" value={newUser.role} onChange={e => setNewUser(u => ({ ...u, role: e.target.value }))}>
                                        <option value="MEMBER">Member</option>
                                        <option value="ADMIN">Admin</option>
                                    </select>
                                </div>
                                <button className="btn btn-primary" onClick={createUser}>Create</button>
                            </div>
                        </div>

                        {/* User list */}
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                            <thead>
                                <tr>
                                    {['Email', 'Role', 'Status', 'Last login', 'Actions'].map(h => (
                                        <th key={h} style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--text-muted)', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid var(--border)' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {users.map(u => (
                                    <tr key={u.id}>
                                        <td style={{ padding: '10px 12px' }}>{u.email}</td>
                                        <td style={{ padding: '10px 12px' }}><span className={`badge ${u.role === 'ADMIN' ? 'badge-admin' : 'badge-member'}`}>{u.role}</span></td>
                                        <td style={{ padding: '10px 12px' }}><span className={`badge ${u.isActive ? 'badge-active' : 'badge-inactive'}`}>{u.isActive ? 'Active' : 'Disabled'}</span></td>
                                        <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : '—'}</td>
                                        <td style={{ padding: '10px 12px' }}>
                                            <div style={{ display: 'flex', gap: '6px' }}>
                                                <button className="btn btn-ghost btn-sm" onClick={() => updateUser(u.id, { isActive: !u.isActive })}>
                                                    {u.isActive ? 'Disable' : 'Enable'}
                                                </button>
                                                {u.role === 'MEMBER' && (
                                                    <button className="btn btn-ghost btn-sm" onClick={() => updateUser(u.id, { role: 'ADMIN' })}>→ Admin</button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* DEFAULTS TAB */}
                {tab === 'defaults' && config && (
                    <div className="card">
                        <h2 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px' }}>Default Settings</h2>
                        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px' }}>These are the defaults loaded in the wizard. Members can override them in Advanced settings.</p>
                        <div style={{ display: 'grid', gap: '16px' }}>
                            <div className="form-group">
                                <label className="label">Default outlier preset</label>
                                <select className="input" defaultValue={config.defaultOutlierPreset}>
                                    <option>Strict</option><option>Normal</option><option>Loose</option>
                                </select>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <div className="form-group">
                                    <label className="label">Min impressions</label>
                                    <input className="input" type="number" defaultValue={config.defaultMinImpressions} />
                                </div>
                                <div className="form-group">
                                    <label className="label">Min spend (€)</label>
                                    <input className="input" type="number" defaultValue={config.defaultMinSpend} />
                                </div>
                            </div>
                            <button className="btn btn-primary" style={{ alignSelf: 'flex-start' }}>Save defaults</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
