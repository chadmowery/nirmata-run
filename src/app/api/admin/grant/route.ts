import { NextResponse } from 'next/server';
import { z } from 'zod';
import { profileRepository } from '@/app/persistence/fs-profile-repository';

const GrantRequestSchema = z.object({
  sessionId: z.string(),
  currency: z.enum(['scrap', 'flux']),
  amount: z.number().int(),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const result = GrantRequestSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({
        error: 'Invalid request',
        details: result.error
      }, { status: 400 });
    }

    const { sessionId, currency, amount } = result.data;
    const profile = await profileRepository.load(sessionId);

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Grant amount (supports negative for revocation)
    profile.wallet[currency] = Math.max(0, profile.wallet[currency] + amount);

    await profileRepository.save(profile);

    return NextResponse.json({
      success: true,
      wallet: profile.wallet
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    return NextResponse.json({ error: 'Internal Server Error', message: error.message }, { status: 500 });
  }
}
