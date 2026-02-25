import * as dotenv from 'dotenv';
dotenv.config();
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { hashPassword } from '../src/lib/auth/hash';

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
    const email = process.env.SEED_ADMIN_EMAIL ?? 'admin@example.com';
    const password = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe123!';
    const hash = await hashPassword(password);

    const admin = await prisma.user.upsert({
        where: { email },
        update: {},
        create: {
            email,
            passwordHash: hash,
            role: 'ADMIN',
            isActive: true,
        },
    });

    // Seed default AppConfig
    await prisma.appConfig.upsert({
        where: { id: 1 },
        update: {},
        create: {
            id: 1,
            defaultOutlierPreset: 'Normal',
            defaultMinImpressions: 1000,
            defaultMinSpend: 10.0,
        },
    });

    console.log(`✅ Admin seeded: ${admin.email}`);
}

main()
    .catch((e) => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());
