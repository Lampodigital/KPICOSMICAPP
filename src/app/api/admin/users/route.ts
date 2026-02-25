import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/rbac/guards';
import { prisma } from '@/lib/db';
import { hashPassword } from '@/lib/auth/hash';

// GET /api/admin/users
export async function GET() {
    const { error } = await requireAdmin();
    if (error) return error;
    const users = await prisma.user.findMany({
        select: { id: true, email: true, role: true, isActive: true, createdAt: true, lastLoginAt: true },
        orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json({ users });
}

// POST /api/admin/users — create user
export async function POST(req: NextRequest) {
    const { error } = await requireAdmin();
    if (error) return error;
    const { email, password, role } = await req.json();
    if (!email || !password) return NextResponse.json({ error: 'email and password required' }, { status: 400 });
    const hash = await hashPassword(password);
    const user = await prisma.user.create({
        data: { email: email.toLowerCase().trim(), passwordHash: hash, role: role ?? 'MEMBER', isActive: true },
        select: { id: true, email: true, role: true },
    });
    return NextResponse.json({ user }, { status: 201 });
}

// PATCH /api/admin/users — update user (disable, promote, reset password)
export async function PATCH(req: NextRequest) {
    const { error } = await requireAdmin();
    if (error) return error;
    const { id, isActive, role, newPassword } = await req.json();
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    const data: Record<string, unknown> = {};
    if (isActive !== undefined) data.isActive = isActive;
    if (role) data.role = role;
    if (newPassword) data.passwordHash = await hashPassword(newPassword);
    const user = await prisma.user.update({ where: { id }, data, select: { id: true, email: true, role: true, isActive: true } });
    return NextResponse.json({ user });
}
