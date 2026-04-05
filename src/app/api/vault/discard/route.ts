import { NextRequest, NextResponse } from 'next/server';
import { discardOverflowItem } from '@/game/systems/vault-manager';
import { profileRepository } from '@/app/persistence/fs-profile-repository';

/**
 * POST /api/vault/discard
 * Discards an item from the overflow limbo.
 */
export async function POST(req: NextRequest) {
  try {
    const { sessionId, entityId } = await req.json();

    if (!sessionId || entityId === undefined) {
      return NextResponse.json({ error: 'Missing sessionId or entityId' }, { status: 400 });
    }

    const success = await discardOverflowItem(profileRepository, sessionId, entityId);
    if (!success) {
      return NextResponse.json({ error: 'Item not found in overflow' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Item discarded' });
  } catch (error) {
    console.error('[VaultDiscard] Error discarding item:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
