import { NextResponse } from 'next/server';
import { z } from 'zod';
import { profileRepository } from '@/app/persistence/fs-profile-repository';
import economyRaw from '@/game/entities/templates/economy.json';
import { EconomyConfig } from '@/shared/economy-types';

const economy = economyRaw as unknown as EconomyConfig;

const CompressRequestSchema = z.object({
  sessionId: z.string().min(1),
  amount: z.number().int().min(1).default(1),
});

export const SCRAP_PER_FLUX = 100;

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const result = CompressRequestSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        {
          error: 'Invalid request',
          details: result.error,
        },
        { status: 400 },
      );
    }

    const { sessionId, amount } = result.data;
    const profile = await profileRepository.load(sessionId);

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const scrapCost = amount * SCRAP_PER_FLUX;
    if (profile.wallet.scrap < scrapCost) {
      return NextResponse.json(
        {
          error: 'Insufficient Scrap',
          required: scrapCost,
          current: profile.wallet.scrap,
        },
        { status: 400 },
      );
    }

    const maxFlux = economy.caps.flux || 1000;
    if (profile.wallet.flux >= maxFlux) {
      return NextResponse.json(
        {
          error: 'Flux Cap Reached',
          maxFlux,
          current: profile.wallet.flux,
        },
        { status: 400 },
      );
    }

    // Compute actual flux gained if close to cap
    const fluxToGain = Math.min(amount, maxFlux - profile.wallet.flux);
    const actualScrapCost = fluxToGain * SCRAP_PER_FLUX;

    profile.wallet.scrap -= actualScrapCost;
    profile.wallet.flux += fluxToGain;

    await profileRepository.save(profile);

    return NextResponse.json({
      success: true,
      message: `Compressed ${actualScrapCost} Scrap into ${fluxToGain} Meta Flux`,
      scrapCost: actualScrapCost,
      fluxGained: fluxToGain,
      wallet: profile.wallet,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Internal Server Error', message: error.message },
      { status: 500 },
    );
  }
}
