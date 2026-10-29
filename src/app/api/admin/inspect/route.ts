import { NextResponse } from 'next/server';
import { z } from 'zod';
import { profileRepository } from '@/app/persistence/fs-profile-repository';
import { generateShopStock } from '../../../../game/systems/shop-rotation';
import { checkNonProductionOnly } from '@/server/security/env-gate';

const InspectQuerySchema = z.object({
  sessionId: z.string().min(1),
});

export async function GET(req: Request) {
  const envBlocked = checkNonProductionOnly();
  if (envBlocked) return envBlocked;

  try {
    const { searchParams } = new URL(req.url);
    const parsed = InspectQuerySchema.safeParse({
      sessionId: searchParams.get('sessionId'),
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'sessionId required', details: parsed.error },
        { status: 400 },
      );
    }

    const { sessionId } = parsed.data;
    const profile = await profileRepository.load(sessionId);

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const shopStock = generateShopStock(profile.weekSeed);

    return NextResponse.json({
      profile,
      shopStock,
      timestamp: Date.now(),
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Internal Server Error', message: error.message },
      { status: 500 },
    );
  }
}
