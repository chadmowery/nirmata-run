import { NextRequest, NextResponse } from 'next/server';
import { profileRepository } from '@/app/persistence/fs-profile-repository';

/**
 * POST /api/vault/equip-from-vault
 * Pre-run Ritual: Equips an item (Firmware/Augment) from Vault onto a Shell.
 */
export async function POST(req: NextRequest) {
  try {
    const { sessionId, entityId, shellId } = await req.json();

    if (!sessionId || entityId === undefined || !shellId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const profile = await profileRepository.load(sessionId);
    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // 1. Find item in Vault
    const vaultIndex = profile.vault.findIndex(item => item.entityId === entityId);
    if (vaultIndex === -1) {
      return NextResponse.json({ error: 'Item not found in Vault' }, { status: 404 });
    }

    const item = profile.vault[vaultIndex];
    if (item.itemType === 'software') {
      return NextResponse.json({ error: 'Software items cannot be equipped via Ritual' }, { status: 400 });
    }

    // 2. Add to installedItems
    profile.installedItems.push({
      blueprintId: item.templateId, // Using templateId as blueprintId for now
      type: item.itemType as 'firmware' | 'augment',
      shellId,
      isLegacy: false,
    });

    // 3. Remove from Vault
    profile.vault.splice(vaultIndex, 1).length;

    await profileRepository.save(profile);

    return NextResponse.json({
      success: true,
      message: `Equipped ${item.templateId} from Vault to ${shellId}`,
    });
  } catch (error) {
    console.error('[VaultEquipFromVault] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
