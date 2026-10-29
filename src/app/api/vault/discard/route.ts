import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { discardOverflowItem } from '@/game/systems/vault-manager';
import { profileRepository } from '@/app/persistence/fs-profile-repository';
import { logger } from '@engine/utils/logger';

const VaultDiscardRequestSchema = z.object({
  sessionId: z.string().min(1),
  entityId: z.number().int(),
});

/**
 * POST /api/vault/discard
 * Discards an item from the overflow limbo.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = VaultDiscardRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Missing sessionId or entityId', details: parsed.error },
        { status: 400 },
      );
    }

    const { sessionId, entityId } = parsed.data;

    const success = await discardOverflowItem(profileRepository, sessionId, entityId);
    if (!success) {
      return NextResponse.json({ error: 'Item not found in overflow' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Item discarded' });
  } catch (error) {
    logger.error('[VaultDiscard] Error discarding item:', 'API', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
