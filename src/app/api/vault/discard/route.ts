import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { discardAllOverflowItems, discardOverflowItem } from '@/game/systems/vault-manager';
import { profileRepository } from '@/app/persistence/fs-profile-repository';
import { logger } from '@engine/utils/logger';

const VaultDiscardRequestSchema = z
  .object({
    sessionId: z.string().min(1),
    vaultItemId: z.string().optional(),
    entityId: z.coerce.number().int().optional(),
    all: z.boolean().optional(),
  })
  .refine(
    (data) => data.all === true || data.vaultItemId !== undefined || data.entityId !== undefined,
    {
      message: 'Missing vaultItemId, entityId, or all',
    },
  );

/**
 * POST /api/vault/discard
 * Discards an item (or all overflow items when `all: true`) from overflow limbo.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = VaultDiscardRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Missing sessionId, vaultItemId or entityId', details: parsed.error },
        { status: 400 },
      );
    }

    const { sessionId, vaultItemId, entityId, all } = parsed.data;

    if (all) {
      const bulkResult = await discardAllOverflowItems(profileRepository, sessionId);
      if (!bulkResult.success) {
        return NextResponse.json({ error: 'No items found in overflow' }, { status: 404 });
      }

      return NextResponse.json({
        success: true,
        message: `Discarded ${bulkResult.discardedCount} overflow items`,
        discardedCount: bulkResult.discardedCount,
      });
    }

    const success = await discardOverflowItem(
      profileRepository,
      sessionId,
      vaultItemId || entityId!,
    );
    if (!success) {
      return NextResponse.json({ error: 'Item not found in overflow' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Item discarded' });
  } catch (error) {
    logger.error('[VaultDiscard] Error discarding item:', 'API', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
