import { NextResponse } from 'next/server';
import { loadProfile } from '../../../../game/systems/profile-persistence';
import { generateShopStock } from '../../../../game/systems/shop-rotation';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId required' }, { status: 400 });
    }

    const profile = await loadProfile(sessionId);

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const shopStock = generateShopStock(profile.weekSeed);

    return NextResponse.json({
      profile,
      shopStock,
      timestamp: Date.now()
    });

  } catch (error: any) {
    return NextResponse.json({ error: 'Internal Server Error', message: error.message }, { status: 500 });
  }
}
