/**
 * Shared utility functions for equipment slots and software socketing.
 */

export function getSoftwareTargetSlot(templateId: string): 'weapon' | 'armor' | null {
  const tid = templateId.toLowerCase();
  if (
    tid.startsWith('bleed') ||
    tid.startsWith('auto-loader') ||
    tid.includes('loader') ||
    tid.includes('void') ||
    tid.includes('strike')
  ) {
    return 'weapon';
  }
  if (
    tid.startsWith('vampire') ||
    tid.includes('vamp') ||
    tid.includes('weave') ||
    tid.includes('nano-weave')
  ) {
    return 'armor';
  }
  return null;
}

export function getEquipmentSlotType(
  templateId: string,
  itemType?: string,
): 'weapon' | 'armor' | null {
  if (itemType === 'weapon') return 'weapon';
  if (itemType === 'armor') return 'armor';

  const tid = templateId.toLowerCase();
  if (tid.startsWith('rifle') || tid.includes('railgun') || tid.includes('weapon')) {
    return 'weapon';
  }
  if (tid.startsWith('armor') || tid.includes('plate') || tid.includes('aegis')) {
    return 'armor';
  }
  return null;
}

export function isWeaponItem(item: { templateId: string; itemType: string }): boolean {
  return getEquipmentSlotType(item.templateId, item.itemType) === 'weapon';
}

export function isArmorItem(item: { templateId: string; itemType: string }): boolean {
  return getEquipmentSlotType(item.templateId, item.itemType) === 'armor';
}

export function isSoftwareItem(item: { templateId: string; itemType: string }): boolean {
  if (item.itemType === 'software') return true;
  return getSoftwareTargetSlot(item.templateId) !== null;
}

export function canSocketSoftware(
  softwareTemplateId: string,
  gearTemplateId: string,
  gearItemType: string,
): boolean {
  const swSlot = getSoftwareTargetSlot(softwareTemplateId);
  const gearSlot = getEquipmentSlotType(gearTemplateId, gearItemType);
  if (!swSlot || !gearSlot) return false;
  return swSlot === gearSlot;
}
