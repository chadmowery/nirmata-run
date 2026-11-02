import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { profileRepository } from '@/app/persistence/fs-profile-repository';
import { globalShellRegistry, applyShellUpgradesToRecord } from '@/game/shells/server';
import { logger } from '@engine/utils/logger';
import { VaultItem } from '@/shared/profile';
import { isWeaponItem, isArmorItem } from '@/shared/utils/equipment-util';

const EquipFromVaultRequestSchema = z.object({
  sessionId: z.string().min(1),
  shellId: z.string().min(1),
  entityId: z.coerce.number().int(),
  targetSlotType: z
    .enum(['firmware', 'augment', 'software', 'weapon', 'armor', 'backpack'])
    .optional(),
});

/**
 * POST /api/vault/equip-from-vault
 * Pre-run Ritual: Equips an item (Firmware, Augment, Software, Weapon, Armor, or Backpack) from Vault onto a Shell.
 */
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.json();
    const parsed = EquipFromVaultRequestSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Missing or invalid required fields', details: parsed.error },
        { status: 400 },
      );
    }

    const { sessionId, shellId, entityId, targetSlotType } = parsed.data;

    const profile = await profileRepository.load(sessionId);
    if (!profile) {
      logger.error(`[VaultEquipFromVault] Profile not found for sessionId: ${sessionId}`, 'API');
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // 1. Find item in Vault
    const vaultIndex = profile.vault.findIndex((item) => item.entityId === entityId);
    if (vaultIndex === -1) {
      logger.warn(`[VaultEquipFromVault] Item not found in Vault: ${entityId}`, 'API');
      return NextResponse.json({ error: 'Item not found in Vault' }, { status: 404 });
    }

    const item = profile.vault[vaultIndex];

    // Determine target slot
    let resolvedSlot = targetSlotType;
    if (!resolvedSlot) {
      if (isWeaponItem(item)) resolvedSlot = 'weapon';
      else if (isArmorItem(item)) resolvedSlot = 'armor';
      else resolvedSlot = item.itemType as 'firmware' | 'augment' | 'software';
    }

    // 2. Validate and handle slot assignment
    if (resolvedSlot === 'weapon') {
      if (!isWeaponItem(item)) {
        return NextResponse.json({ error: 'Item cannot be equipped as a weapon' }, { status: 400 });
      }
      // Unequip existing weapon if present
      const existingIdx = profile.installedItems.findIndex(
        (i) => i.shellId === shellId && i.type === 'weapon',
      );
      if (existingIdx !== -1) {
        const old = profile.installedItems[existingIdx];
        profile.installedItems.splice(existingIdx, 1);
        const restored: VaultItem = {
          entityId: old.entityId,
          templateId: old.blueprintId,
          rarityTier: 'common',
          itemType: 'weapon',
          extractedAtFloor: 0,
          extractedAtTimestamp: Date.now(),
          socketedSoftware: old.socketedSoftware || [],
        };
        profile.vault.push(restored);
      }

      profile.installedItems.push({
        entityId: item.entityId,
        blueprintId: item.templateId,
        type: 'weapon',
        shellId,
        isLegacy: false,
        socketedSoftware: item.socketedSoftware || [],
      });
      profile.vault.splice(vaultIndex, 1);
    } else if (resolvedSlot === 'armor') {
      if (!isArmorItem(item)) {
        return NextResponse.json({ error: 'Item cannot be equipped as armor' }, { status: 400 });
      }
      // Unequip existing armor if present
      const existingIdx = profile.installedItems.findIndex(
        (i) => i.shellId === shellId && i.type === 'armor',
      );
      if (existingIdx !== -1) {
        const old = profile.installedItems[existingIdx];
        profile.installedItems.splice(existingIdx, 1);
        const restored: VaultItem = {
          entityId: old.entityId,
          templateId: old.blueprintId,
          rarityTier: 'common',
          itemType: 'armor',
          extractedAtFloor: 0,
          extractedAtTimestamp: Date.now(),
          socketedSoftware: old.socketedSoftware || [],
        };
        profile.vault.push(restored);
      }

      profile.installedItems.push({
        entityId: item.entityId,
        blueprintId: item.templateId,
        type: 'armor',
        shellId,
        isLegacy: false,
        socketedSoftware: item.socketedSoftware || [],
      });
      profile.vault.splice(vaultIndex, 1);
    } else if (resolvedSlot === 'backpack') {
      const backpackItems = profile.installedItems.filter(
        (i) => i.shellId === shellId && i.type === 'backpack',
      );
      if (backpackItems.length >= 5) {
        return NextResponse.json(
          { error: 'Backpack loadout capacity reached (max 5)' },
          { status: 400 },
        );
      }

      profile.installedItems.push({
        entityId: item.entityId,
        blueprintId: item.templateId,
        type: 'backpack',
        shellId,
        isLegacy: false,
        socketedSoftware: item.socketedSoftware || [],
      });
      profile.vault.splice(vaultIndex, 1);
    } else {
      // Standard Firmware / Augment / Software ports
      let shellRecord = globalShellRegistry.get(shellId);
      if (!shellRecord) {
        try {
          shellRecord = globalShellRegistry.createRecord(shellId, shellId);
        } catch {
          const template = globalShellRegistry.getTemplates().find((t) => t.id === shellId);
          if (template) {
            shellRecord = globalShellRegistry.createRecord(shellId, template.id);
          }
        }
      }

      if (shellRecord) {
        const upgradeData = profile.shellUpgrades?.[shellId];
        if (upgradeData) {
          shellRecord = applyShellUpgradesToRecord(shellRecord, upgradeData);
        }
      }

      if (shellRecord?.portConfig) {
        const installedForShell = profile.installedItems.filter(
          (installed) => installed.shellId === shellId && installed.type === resolvedSlot,
        );

        let maxLimit = Infinity;
        if (resolvedSlot === 'firmware') maxLimit = shellRecord.portConfig.maxFirmware;
        else if (resolvedSlot === 'augment') maxLimit = shellRecord.portConfig.maxAugment;
        else if (resolvedSlot === 'software') maxLimit = shellRecord.portConfig.maxSoftware;

        if (installedForShell.length >= maxLimit) {
          return NextResponse.json(
            { error: `Exceeded port capacity for ${resolvedSlot}. Max: ${maxLimit}` },
            { status: 400 },
          );
        }
      }

      profile.installedItems.push({
        entityId: item.entityId,
        blueprintId: item.templateId,
        type: resolvedSlot as 'firmware' | 'augment' | 'software',
        shellId,
        isLegacy: false,
        socketedSoftware: item.socketedSoftware || [],
      });
      profile.vault.splice(vaultIndex, 1);
    }

    await profileRepository.save(profile);

    return NextResponse.json({
      success: true,
      message: `Equipped ${item.templateId} from Vault to ${shellId} (${resolvedSlot})`,
      profile,
    });
  } catch (error) {
    logger.error('[VaultEquipFromVault] Error:', 'API', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
