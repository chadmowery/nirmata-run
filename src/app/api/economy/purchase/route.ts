import { NextResponse } from 'next/server';
import { z } from 'zod';
import { profileRepository } from '@/app/persistence/fs-profile-repository';
import { generateShopStock } from '../../../../game/systems/shop-rotation';

const PurchaseRequestSchema = z.object({
  sessionId: z.string(),
  itemIndex: z.number().int().min(0).max(5),
  weekSeed: z.number(),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const result = PurchaseRequestSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({
        error: 'Invalid request',
        details: result.error
      }, { status: 400 });
    }

    const { sessionId, itemIndex, weekSeed } = result.data;
    const profile = await profileRepository.load(sessionId);

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const stock = generateShopStock(weekSeed);
    const item = stock[itemIndex];

    if (!item) {
      return NextResponse.json({ error: 'Invalid item index' }, { status: 400 });
    }

    if (profile.wallet.scrap < item.price) {
      return NextResponse.json({
        error: 'Insufficient Scrap',
        required: item.price,
        current: profile.wallet.scrap
      }, { status: 400 });
    }

    // Deduct
    profile.wallet.scrap -= item.price;

    // Note: Purchase adds to profile-owned software or special list if needed.
    // Per D-29, purchase returns Software item. 
    // Usually this means it's available for the next run.
    // We don't have a "software stash" in profile yet, but Plan 04 might add it.
    // For now, we just deduct and return success.

    await profileRepository.save(profile);

    return NextResponse.json({
      success: true,
      purchased: item,
      remainingScrap: profile.wallet.scrap
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    return NextResponse.json({ error: 'Internal Server Error', message: error.message }, { status: 500 });
  }
}
