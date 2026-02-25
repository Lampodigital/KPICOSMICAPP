import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyPassword } from '@/lib/auth/hash';
import { createSession, setSessionCookie } from '@/lib/auth/session';

const RATE_LIMIT = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 60 * 1000; // 1 minute

function isRateLimited(ip: string): boolean {
    const now = Date.now();
    const entry = RATE_LIMIT.get(ip);
    if (!entry || entry.resetAt < now) {
        RATE_LIMIT.set(ip, { count: 1, resetAt: now + WINDOW_MS });
        return false;
    }
    entry.count++;
    if (entry.count > MAX_ATTEMPTS) return true;
    return false;
}

export async function POST(req: NextRequest) {
    const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'unknown';
    if (isRateLimited(ip)) {
        return NextResponse.json({ error: 'Too many attempts. Wait 1 minute.' }, { status: 429 });
    }

    const { email, password } = await req.json();
    if (!email || !password) {
        return NextResponse.json({ error: 'Missing credentials' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (!user || !user.isActive) {
        return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
        return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
    });

    const token = await createSession({ userId: user.id, role: user.role });
    await setSessionCookie(token);

    return NextResponse.json({ ok: true, role: user.role });
}
