'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

export default function LoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });
            const data = await res.json();
            if (!res.ok) { setError(data.error ?? 'Login failed'); return; }
            router.push(data.role === 'ADMIN' ? '/admin' : '/wizard');
        } catch {
            setError('Network error. Please try again.');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div style={{ minHeight: '100vh', display: 'flex', backgroundColor: 'var(--bg-base)' }}>
            {/* Left side: Brand area */}
            <div style={{
                flex: 1,
                backgroundColor: '#1734F7', /* Pure Cosmic Blue */
                color: 'white',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                padding: '10%',
                position: 'relative',
                overflow: 'hidden',
                /* Hidden on mobile, handled via inline media query simulation or just block on larger screens */
            }} className="login-brand-panel">
                <style>{`
                    @media (min-width: 900px) { .login-brand-panel { display: flex !important; } }
                `}</style>

                {/* Abstract light mesh decoration */}
                <div style={{ position: 'absolute', top: '10%', right: '-20%', width: '60vw', height: '60vw', background: 'radial-gradient(circle, var(--accent) 0%, transparent 60%)', opacity: 0.15, borderRadius: '50%' }} />
                <div style={{ position: 'absolute', bottom: '-20%', left: '-10%', width: '50vw', height: '50vw', background: 'radial-gradient(circle, var(--accent) 0%, transparent 60%)', opacity: 0.2, borderRadius: '50%' }} />

                <div style={{ zIndex: 1, maxWidth: '540px' }}>
                    <h1 style={{ fontSize: '48px', fontWeight: 900, lineHeight: 1.15, marginBottom: '20px', letterSpacing: '-0.03em' }}>
                        Keep your KPIs in your pocket!
                    </h1>
                    <p style={{ fontSize: '20px', color: 'rgba(255,255,255,0.85)', fontWeight: 400, lineHeight: 1.5 }}>
                        Discover the Cosmic Master benchmark tool, designed for creators and brands.
                    </p>
                </div>
            </div>

            {/* Right side: Form area */}
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px' }}>
                <div style={{ width: '100%', maxWidth: '420px' }}>
                    <div className="text-center mb-8" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <img src="/brand/cosmic-logo-blue.png" alt="Cosmic Logo" style={{ width: '180px', height: '45px', objectFit: 'contain', filter: 'brightness(0) invert(1)' }} />
                        <h2 style={{ fontSize: '32px', fontWeight: 900, letterSpacing: '-0.03em', marginTop: '40px', color: 'var(--text-primary)' }}>
                            Log in to your account
                        </h2>
                    </div>

                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                        <div className="form-group">
                            <label className="label" htmlFor="email">E-mail address</label>
                            <input
                                id="email"
                                className={`input ${error ? 'input-error' : ''}`}
                                type="email"
                                placeholder="example@mail.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                autoFocus
                            />
                        </div>

                        <div className="form-group">
                            <label className="label" htmlFor="password">Password</label>
                            <input
                                id="password"
                                className={`input ${error ? 'input-error' : ''}`}
                                type="password"
                                placeholder="Type your password here"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                            <div style={{ textAlign: 'right', marginTop: '4px' }}>
                                <a href="#" style={{ fontSize: '13px', color: 'var(--accent)', fontWeight: 500 }}>I forgot my password</a>
                            </div>
                        </div>

                        {error && (
                            <div className="alert alert-error">
                                <span>⚠</span> {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            className="btn btn-primary btn-lg w-full"
                            style={{ padding: '16px', fontSize: '16px', marginTop: '8px' }}
                            disabled={loading}
                        >
                            {loading ? 'Signing in…' : 'Log in'}
                        </button>
                    </form>

                    <p className="text-center mt-6" style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                        Don't have an account yet? <strong style={{ color: 'var(--text-primary)', fontWeight: 700 }}>Contact Admin</strong>
                    </p>
                </div>
            </div>
        </div>
    );
}
