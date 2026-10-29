import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { sellOverflowItem } from '@/game/systems/vault-manager';
import { profileRepository } from '@/app/persistence/fs-profile-repository';
import { logger } from '@engine/utils/logger';

const VaultSellRequestSchema = z.object({
  sessionId: z.string().min(1),
  entityId: z.number().int(),
});

/**
 * POST /api/vault/sell
 * Sells an item from the overflow limbo for Scrap.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = VaultSellRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Missing sessionId or entityId', details: parsed.error },
        { status: 400 },
      );
    }

    const { sessionId, entityId } = parsed.data;

    const result = await sellOverflowItem(profileRepository, sessionId, entityId);
    if (!result.success) {
      return NextResponse.json({ error: 'Item not found in overflow' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: 'Item sold',
      scrapGained: result.scrapGained,
    });
  } catch (error) {
    logger.error('[VaultSell] Error selling item:', 'API', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
