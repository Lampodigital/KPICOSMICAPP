import { getSession } from '@/lib/auth/session';
import { NextResponse } from 'next/server';

export async function requireAuth() {
    const session = await getSession();
    if (!session) {
        return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }), session: null };
    }
    return { error: null, session };
}

export async function requireAdmin() {
    const { error, session } = await requireAuth();
    if (error || !session) return { error: error ?? NextResponse.json({ error: 'Unauthorized' }, { status: 401 }), session: null };
    if (session.role !== 'ADMIN') {
        return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }), session: null };
    }
    return { error: null, session };
}
