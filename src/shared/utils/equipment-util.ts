/**
 * Shared utility functions for equipment slots and software socketing.
 */

export function getSoftwareTargetSlot(templateId?: string): 'weapon' | 'armor' | null {
  if (!templateId) return null;
  const tid = templateId.toLowerCase().trim();
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
    tid.includes('nano-weave') ||
    tid.includes('barrier') ||
    tid.includes('repair')
  ) {
    return 'armor';
  }
  return null;
}

export function getEquipmentSlotType(
  templateId?: string,
  itemType?: string,
): 'weapon' | 'armor' | null {
  const normType = itemType?.toLowerCase().trim();
  if (normType === 'weapon') return 'weapon';
  if (normType === 'armor') return 'armor';

  const tid = (templateId || '').toLowerCase().trim();
  if (tid.startsWith('rifle') || tid.includes('railgun') || tid.includes('weapon')) {
    return 'weapon';
  }
  if (tid.startsWith('armor') || tid.includes('plate') || tid.includes('aegis')) {
    return 'armor';
  }
  return null;
}

export function isWeaponItem(item: { templateId?: string; itemType?: string; type?: string }): boolean {
  const type = item.itemType || item.type;
  return getEquipmentSlotType(item.templateId, type) === 'weapon';
}

export function isArmorItem(item: { templateId?: string; itemType?: string; type?: string }): boolean {
  const type = item.itemType || item.type;
  return getEquipmentSlotType(item.templateId, type) === 'armor';
}

export function isSoftwareItem(item: { templateId?: string; itemType?: string; type?: string }): boolean {
  const rawType = (item.itemType || item.type)?.toLowerCase().trim();
  if (rawType === 'software') return true;
  if (rawType && rawType !== 'software' && rawType !== 'equipment') {
    // Explicitly another type (e.g. firmware, augment, weapon, armor)
    return false;
  }
  return getSoftwareTargetSlot(item.templateId) !== null;
}

export function canSocketSoftware(
  softwareTemplateId: string,
  gearTemplateId: string,
  gearItemType?: string,
): boolean {
  // If target slot is explicit on template, use it; otherwise fallback to 'weapon' for generic software
  const swSlot = getSoftwareTargetSlot(softwareTemplateId) || 'weapon';
  const gearSlot = getEquipmentSlotType(gearTemplateId, gearItemType);
  if (!gearSlot) return false;
  return swSlot === gearSlot;
}
