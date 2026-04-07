import { NextResponse } from 'next/server';
import { z } from 'zod';
import { profileRepository } from '@/app/persistence/fs-profile-repository';
import economyRaw from '../../../../game/entities/templates/economy.json';
import { EconomyConfig } from '@/shared/economy-types';

const economy = economyRaw as unknown as EconomyConfig;

const InstallRequestSchema = z.object({
  sessionId: z.string(),
  blueprintId: z.string(),
  shellId: z.string(),
  type: z.enum(['firmware', 'augment']),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const result = InstallRequestSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({
        error: 'Invalid request',
        details: result.error
      }, { status: 400 });
    }

    const { sessionId, blueprintId, shellId, type } = result.data;
    const profile = await profileRepository.load(sessionId);

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Check if in library
    if (!profile.blueprintLibrary.some(b => b.blueprintId === blueprintId)) {
      return NextResponse.json({ error: 'Blueprint not compiled' }, { status: 400 });
    }

    const cost = economy.costs.installation[type];
    if (profile.wallet.scrap < cost) {
      return NextResponse.json({
        error: 'Insufficient Scrap',
        required: cost,
        current: profile.wallet.scrap
      }, { status: 400 });
    }

    // Deduct and install
    profile.wallet.scrap -= cost;
    profile.installedItems.push({
      entityId: Date.now(), // Generate unique ID for the new installation instance
      blueprintId,
      type,
      shellId,
      isLegacy: false
    });

    await profileRepository.save(profile);

    return NextResponse.json({
      success: true,
      remainingScrap: profile.wallet.scrap
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    return NextResponse.json({ error: 'Internal Server Error', message: error.message }, { status: 500 });
  }
}
