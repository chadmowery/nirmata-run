import { NextRequest, NextResponse } from 'next/server';
import { profileRepository } from '@/app/persistence/fs-profile-repository';

import { logger } from '@engine/utils/logger';

/**
 * POST /api/vault/equip-from-vault
 * Pre-run Ritual: Equips an item (Firmware/Augment) from Vault onto a Shell.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sessionId, shellId } = body;
    const entityId = Number(body.entityId);

    if (!sessionId || isNaN(entityId) || !shellId) {
      return NextResponse.json({ error: 'Missing or invalid required fields' }, { status: 400 });
    }

    const profile = await profileRepository.load(sessionId);
    if (!profile) {
      logger.error(`[VaultEquipFromVault] Profile not found for sessionId: ${sessionId}`, 'API');
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // 1. Find item in Vault
    logger.debug(`[VaultEquipFromVault] Vault contents:`, 'API', profile.vault.map(i => ({ id: i.entityId, type: i.itemType })));
    const vaultIndex = profile.vault.findIndex(item => item.entityId === entityId);
    if (vaultIndex === -1) {
      logger.warn(`[VaultEquipFromVault] Item not found in Vault: ${entityId}`, 'API');
      return NextResponse.json({ error: 'Item not found in Vault' }, { status: 404 });
    }

    const item = profile.vault[vaultIndex];
    // 2. Add to installedItems
    profile.installedItems.push({
      entityId: item.entityId, // Preserve the authoritative entityId
      blueprintId: item.templateId, // Using templateId as blueprintId for now
      type: item.itemType as 'firmware' | 'augment' | 'software',
      shellId,
      isLegacy: false,
    });

    // 3. Remove from Vault
    profile.vault.splice(vaultIndex, 1);

    await profileRepository.save(profile);

    return NextResponse.json({
      success: true,
      message: `Equipped ${item.templateId} from Vault to ${shellId}`,
    });
  } catch (error) {
    logger.error('[VaultEquipFromVault] Error:', 'API', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
