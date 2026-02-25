import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const SECRET = new TextEncoder().encode(
    process.env.SESSION_SECRET ?? 'dev-secret-must-change-in-production'
);

const PUBLIC_PATHS = ['/login', '/api/auth/login'];

export async function middleware(req: NextRequest) {
    const { pathname } = req.nextUrl;

    // Allow public routes
    if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
        return NextResponse.next();
    }

    const token = req.cookies.get('kpi_session')?.value;
    if (!token) {
        return NextResponse.redirect(new URL('/login', req.url));
    }

    try {
        const { payload } = await jwtVerify(token, SECRET) as { payload: { userId: string; role: string } };

        // Protect admin routes
        if (pathname.startsWith('/admin') || pathname.startsWith('/api/admin')) {
            if (payload.role !== 'ADMIN') {
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
            }
        }

        return NextResponse.next();
    } catch {
        return NextResponse.redirect(new URL('/login', req.url));
    }
}

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
