import { NextResponse } from 'next/server';
import { z } from 'zod';
import { profileRepository } from '@/app/persistence/fs-profile-repository';
import { VAULT_MAX_SLOTS } from '@/shared/vault';
import { VaultItem } from '@/shared/profile';

const UninstallRequestSchema = z.object({
  sessionId: z.string(),
  blueprintId: z.string(),
  shellId: z.string(),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const result = UninstallRequestSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({
        error: 'Invalid request',
        details: result.error
      }, { status: 400 });
    }

    const { sessionId, blueprintId, shellId } = result.data;
    const profile = await profileRepository.load(sessionId);

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const index = profile.installedItems.findIndex(
      i => i.blueprintId === blueprintId && i.shellId === shellId
    );

    if (index === -1) {
      return NextResponse.json({ error: 'Item not installed on this Shell' }, { status: 400 });
    }

    const item = profile.installedItems[index];

    // Create a VaultItem to restore it, preserving the existing entityId
    const restoredItem: VaultItem = {
      entityId: item.entityId || Date.now(), // Fallback for legacy items without an ID
      templateId: item.blueprintId,
      rarityTier: 'common', // Default for uninstalled items unless we store more metadata
      itemType: item.type as 'firmware' | 'augment' | 'software',
      extractedAtFloor: 0, // 0 indicates Hub action
      extractedAtTimestamp: Date.now(),
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

    return NextResponse.json({ success: true });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    return NextResponse.json({ error: 'Internal Server Error', message: error.message }, { status: 500 });
  }
}
