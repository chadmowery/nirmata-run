import { NextResponse } from 'next/server';
import { z } from 'zod';
import { profileRepository } from '@/app/persistence/fs-profile-repository';
import economyRaw from '../../../../game/entities/templates/economy.json';
import { EconomyConfig } from '@/shared/economy-types';

const economy = economyRaw as unknown as EconomyConfig;

const CompileRequestSchema = z.object({
  sessionId: z.string(),
  blueprintId: z.string(),
  type: z.enum(['firmware', 'augment']),
  rarity: z.enum(['common', 'uncommon', 'rare', 'legendary']),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const result = CompileRequestSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({
        error: 'Invalid request',
        details: result.error
      }, { status: 400 });
    }

    const { sessionId, blueprintId, type, rarity } = result.data;
    const profile = await profileRepository.load(sessionId);

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Check if already compiled
    if (profile.blueprintLibrary.some(b => b.blueprintId === blueprintId)) {
      return NextResponse.json({ error: 'Blueprint already compiled' }, { status: 400 });
    }

    const cost = economy.costs.compilation[rarity];
    if (profile.wallet.flux < cost) {
      return NextResponse.json({
        error: 'Insufficient Flux',
        required: cost,
        current: profile.wallet.flux
      }, { status: 400 });
    }

    // Deduct and add
    profile.wallet.flux -= cost;
    profile.blueprintLibrary.push({
      blueprintId,
      type,
      compiledAt: Date.now()
    });

    await profileRepository.save(profile);

    return NextResponse.json({
      success: true,
      remainingFlux: profile.wallet.flux,
      librarySize: profile.blueprintLibrary.length
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    return NextResponse.json({ error: 'Internal Server Error', message: error.message }, { status: 500 });
  }
}
