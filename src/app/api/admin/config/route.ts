import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/rbac/guards';
import { prisma } from '@/lib/db';

const configSchema = z.object({
    defaultOutlierPreset: z.enum(['Strict', 'Balanced', 'Conservative']).optional(),
    defaultMinImpressions: z.number().nonnegative().optional(),
    defaultMinSpend: z.number().nonnegative().optional(),
    qualityPresetsOverrides: z.unknown().optional(),
    badgeThresholdsOverrides: z.unknown().optional(),
});

export async function PATCH(req: NextRequest) {
    const { error } = await requireAdmin();
    if (error) return error;

    let body;
    try {
        const rawBody = await req.json();
        body = configSchema.parse(rawBody);
    } catch (err) {
        if (err instanceof z.ZodError) {
            return NextResponse.json({ error: 'Invalid config payload', details: err.issues }, { status: 400 });
        }
        return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }

    try {
        const updateData: any = {};
        if (body.defaultOutlierPreset !== undefined) updateData.defaultOutlierPreset = body.defaultOutlierPreset;
        if (body.defaultMinImpressions !== undefined) updateData.defaultMinImpressions = body.defaultMinImpressions;
        if (body.defaultMinSpend !== undefined) updateData.defaultMinSpend = body.defaultMinSpend;

        if (body.qualityPresetsOverrides !== undefined) updateData.qualityPresetsOverrides = body.qualityPresetsOverrides;
        if (body.badgeThresholdsOverrides !== undefined) updateData.badgeThresholdsOverrides = body.badgeThresholdsOverrides;

        const config = await prisma.appConfig.update({
            where: { id: 1 },
            data: updateData
        });

        return NextResponse.json({ ok: true, config });
    } catch (err: any) {
        return NextResponse.json({ error: err.message || 'Failed to update configuration' }, { status: 500 });
    }
}
