import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { profileRepository } from '@/app/persistence/fs-profile-repository';
import { logger } from '@engine/utils/logger';
import { getSoftwareTargetSlot, getEquipmentSlotType } from '@/shared/utils/equipment-util';

const SocketSoftwareRequestSchema = z
  .object({
    sessionId: z.string().min(1),
    targetEntityId: z.coerce.number().int().optional(),
    targetVaultItemId: z.string().optional(),
    softwareEntityId: z.coerce.number().int().optional(),
    softwareVaultItemId: z.string().optional(),
  })
  .refine(
    (data) =>
      (data.targetEntityId !== undefined || data.targetVaultItemId !== undefined) &&
      (data.softwareEntityId !== undefined || data.softwareVaultItemId !== undefined),
    { message: 'Both target and software identifiers must be provided' },
  );

/**
 * POST /api/vault/socket-software
 * Attaches a software sub-routine from Vault onto a physical weapon or armor in Vault or Loadout.
 */
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.json();
    const parsed = SocketSoftwareRequestSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Missing or invalid required fields', details: parsed.error },
        { status: 400 },
      );
    }

    const { sessionId, targetEntityId, targetVaultItemId, softwareEntityId, softwareVaultItemId } =
      parsed.data;

    const profile = await profileRepository.load(sessionId);
    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // 1. Find software in Vault
    const swIndex = softwareVaultItemId
      ? profile.vault.findIndex((i) => i.vaultItemId === softwareVaultItemId)
      : profile.vault.findIndex((i) => i.entityId === softwareEntityId);
    if (swIndex === -1) {
      return NextResponse.json({ error: 'Software not found in Vault' }, { status: 404 });
    }
    const softwareItem = profile.vault[swIndex];
    const swTargetSlot = getSoftwareTargetSlot(softwareItem.templateId);

    if (!swTargetSlot) {
      return NextResponse.json(
        { error: `Item ${softwareItem.templateId} is not a valid software program` },
        { status: 400 },
      );
    }

    // 2. Find target gear (can be in vault or in installedItems)
    const vaultGear = targetVaultItemId
      ? profile.vault.find((i) => i.vaultItemId === targetVaultItemId)
      : targetEntityId !== undefined
        ? profile.vault.find((i) => i.entityId === targetEntityId)
        : undefined;
    const installedGear =
      targetEntityId !== undefined
        ? profile.installedItems.find((i) => i.entityId === targetEntityId)
        : undefined;

    if (!vaultGear && !installedGear) {
      return NextResponse.json({ error: 'Target weapon or armor not found' }, { status: 404 });
    }

    const gear = vaultGear || installedGear!;
    const gearTemplate = vaultGear ? vaultGear.templateId : installedGear!.blueprintId;
    const gearType = vaultGear ? vaultGear.itemType : installedGear!.type;
    const gearSlot = getEquipmentSlotType(gearTemplate, gearType);

    if (!gearSlot) {
      return NextResponse.json(
        { error: `Target ${gearTemplate} is neither a weapon nor armor` },
        { status: 400 },
      );
    }

    // 3. Slot compatibility check
    if (swTargetSlot !== gearSlot) {
      return NextResponse.json(
        {
          error: `Incompatible software: ${softwareItem.templateId} requires ${swTargetSlot} slot, but target is ${gearSlot}`,
        },
        { status: 400 },
      );
    }

    // 4. Attach software to gear
    gear.socketedSoftware = [softwareItem.templateId];

    // 5. Remove consumed software from vault
    profile.vault.splice(swIndex, 1);

    await profileRepository.save(profile);

    logger.info(
      `[SocketSoftware] Attached ${softwareItem.templateId} to ${gearTemplate} (${targetEntityId}) for session ${sessionId}`,
      'API',
    );

    return NextResponse.json({
      success: true,
      message: `Successfully loaded ${softwareItem.templateId} onto ${gearTemplate}`,
      targetEntityId,
      softwareTemplateId: softwareItem.templateId,
      profile,
    });
  } catch (error) {
    logger.error('[SocketSoftware] Error:', 'API', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
