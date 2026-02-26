import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/rbac/guards';
import { prisma } from '@/lib/db';

export async function PATCH(req: NextRequest) {
    const { error } = await requireAdmin();
    if (error) return error;

    try {
        const body = await req.json();

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
