import { NextRequest, NextResponse } from 'next/server';
import { moveOverflowToVault } from '@/game/systems/vault-manager';

/**
 * POST /api/vault/move-to-vault
 * Moves items from overflow limbo to the persistent Vault.
 */
export async function POST(req: NextRequest) {
  try {
    const { sessionId } = await req.json();

    if (!sessionId) {
      return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });
    }

    const result = await moveOverflowToVault(sessionId);

    return NextResponse.json({
      success: true,
      moved: result.moved,
      remaining: result.remaining,
      message: result.moved > 0 
        ? `Successfully moved ${result.moved} items to Vault`
        : result.remaining > 0 ? 'Vault is full' : 'Overflow is empty',
    });
  } catch (error) {
    console.error('[VaultMoveToVault] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
