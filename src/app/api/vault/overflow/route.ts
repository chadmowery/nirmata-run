import { NextRequest, NextResponse } from 'next/server';
import { profileRepository } from '@/app/persistence/fs-profile-repository';
import { VAULT_MAX_SLOTS } from '@shared/vault';

/**
 * GET /api/vault/overflow
 * Returns the current overflow items for the session.
 */
export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get('sessionId');
  if (!sessionId) {
    return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });
  }

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
    console.error('[VaultOverflow] Error loading profile:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
