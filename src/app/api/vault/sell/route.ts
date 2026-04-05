import { NextRequest, NextResponse } from 'next/server';
import { sellOverflowItem } from '@/game/systems/vault-manager';
import { profileRepository } from '@/app/persistence/fs-profile-repository';

/**
 * POST /api/vault/sell
 * Sells an item from the overflow limbo for Scrap.
 */
export async function POST(req: NextRequest) {
  try {
    const { sessionId, entityId } = await req.json();

    if (!sessionId || entityId === undefined) {
      return NextResponse.json({ error: 'Missing sessionId or entityId' }, { status: 400 });
    }

    const result = await sellOverflowItem(profileRepository, sessionId, entityId);
    if (!result.success) {
      return NextResponse.json({ error: 'Item not found in overflow' }, { status: 404 });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Item sold', 
      scrapGained: result.scrapGained 
    });
  } catch (error) {
    console.error('[VaultSell] Error selling item:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
