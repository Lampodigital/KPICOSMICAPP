import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

const SECRET = new TextEncoder().encode(
    process.env.SESSION_SECRET ?? 'dev-secret-must-change-in-production'
);
const COOKIE_NAME = 'kpi_session';
const SESSION_DURATION = 60 * 60 * 8; // 8 hours

export interface SessionPayload {
    userId: string;
    role: 'ADMIN' | 'MEMBER';
    [key: string]: unknown;
}

export async function createSession(payload: SessionPayload): Promise<string> {
    return new SignJWT(payload)
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime(`${SESSION_DURATION}s`)
        .sign(SECRET);
}

export async function getSession(): Promise<SessionPayload | null> {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (!token) return null;
    try {
        const { payload } = await jwtVerify(token, SECRET);
        return payload as unknown as SessionPayload;
    } catch {
        return null;
    }
}

export function setSessionCookie(token: string): Promise<void> {
    return (async () => {
        const cookieStore = await cookies();
        cookieStore.set(COOKIE_NAME, token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: SESSION_DURATION,
            path: '/',
        });
    })();
}

export async function clearSessionCookie(): Promise<void> {
    const cookieStore = await cookies();
    cookieStore.delete(COOKIE_NAME);
}
