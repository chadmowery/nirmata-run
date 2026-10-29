import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { profileRepository } from '@/app/persistence/fs-profile-repository';
import { VAULT_MAX_SLOTS } from '@shared/vault';
import { logger } from '@engine/utils/logger';

const VaultOverflowQuerySchema = z.object({
  sessionId: z.string().min(1),
});

/**
 * GET /api/vault/overflow
 * Returns the current overflow items for the session.
 */
export async function GET(req: NextRequest) {
  const parsed = VaultOverflowQuerySchema.safeParse({
    sessionId: req.nextUrl.searchParams.get('sessionId'),
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Missing sessionId', details: parsed.error },
      { status: 400 },
    );
  }

  const { sessionId } = parsed.data;

  try {
    const profile = await profileRepository.load(sessionId);
    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    return NextResponse.json({
      overflow: profile.overflow,
      vaultSize: profile.vault.length,
      maxVaultSize: VAULT_MAX_SLOTS,
    });
  } catch (error) {
    logger.error('[VaultOverflow] Error loading profile:', 'API', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
