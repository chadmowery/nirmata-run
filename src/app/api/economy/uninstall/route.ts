import { NextResponse } from 'next/server';
import { z } from 'zod';
import { profileRepository } from '@/app/persistence/fs-profile-repository';
import { VAULT_MAX_SLOTS } from '@/shared/vault';
import { VaultItem } from '@/shared/profile';
import { isWeaponItem, isArmorItem } from '@/shared/utils/equipment-util';

const UninstallRequestSchema = z.object({
  sessionId: z.string(),
  blueprintId: z.string().optional(),
  entityId: z.number().optional(),
  shellId: z.string(),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const result = UninstallRequestSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        {
          error: 'Invalid request',
          details: result.error,
        },
        { status: 400 },
      );
    }

    const { sessionId, blueprintId, entityId, shellId } = result.data;
    const profile = await profileRepository.load(sessionId);

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const index = profile.installedItems.findIndex((i) => {
      if (i.shellId !== shellId) return false;
      if (entityId !== undefined) return i.entityId === entityId;
      return i.blueprintId === blueprintId;
    });

    if (index === -1) {
      return NextResponse.json({ error: 'Item not installed on this Shell' }, { status: 400 });
    }

    const item = profile.installedItems[index];

    // Determine restored item type
    let restoredType: VaultItem['itemType'] = 'software';
    if (item.type === 'weapon' || isWeaponItem({ templateId: item.blueprintId, itemType: item.type })) {
      restoredType = 'weapon';
    } else if (item.type === 'armor' || isArmorItem({ templateId: item.blueprintId, itemType: item.type })) {
      restoredType = 'armor';
    } else if (item.type === 'firmware') {
      restoredType = 'firmware';
    } else if (item.type === 'augment') {
      restoredType = 'augment';
    }

    // Create a VaultItem to restore it, preserving the existing entityId and socketedSoftware
    const restoredItem: VaultItem = {
      entityId: item.entityId || Date.now(),
      templateId: item.blueprintId,
      rarityTier: 'common',
      itemType: restoredType,
      extractedAtFloor: 0,
      extractedAtTimestamp: Date.now(),
      socketedSoftware: item.socketedSoftware || [],
    };

    // Remove from installed list
    profile.installedItems.splice(index, 1);

    // Restore to Vault or Overflow
    if (profile.vault.length < VAULT_MAX_SLOTS) {
      profile.vault.push(restoredItem);
    } else {
      profile.overflow.push(restoredItem);
    }

    await profileRepository.save(profile);

    return NextResponse.json({ success: true, profile });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Internal Server Error', message: error.message },
      { status: 500 },
    );
  }
}
