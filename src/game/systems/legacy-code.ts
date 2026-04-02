import { PlayerProfile, InstalledItem } from './profile-persistence';

/**
 * Calculate effective Heat cost for a Firmware ability.
 * Legacy Code doubles the Heat cost (per D-17).
 */
export function getLegacyHeatCost(baseHeatCost: number, isLegacy: boolean): number {
  return isLegacy ? baseHeatCost * 2 : baseHeatCost;
}

/**
 * Calculate effective payload magnitude for an Augment.
 * Legacy Augments have halved payload magnitude (per D-18).
 */
export function getLegacyMagnitude(baseMagnitude: number, isLegacy: boolean): number {
  return isLegacy ? baseMagnitude * 0.5 : baseMagnitude;
}

/**
 * Mark all installed items in a profile as Legacy.
 * Called during weekly reset.
 */
export function applyLegacyToProfile(profile: PlayerProfile): void {
  for (const item of profile.installedItems) {
    item.isLegacy = true;
  }
}

/**
 * Check if a specific blueprint is Legacy for a given profile.
 */
export function isItemLegacy(profile: PlayerProfile, blueprintId: string, shellId: string): boolean {
  const installed = profile.installedItems.find(
    i => i.blueprintId === blueprintId && i.shellId === shellId
  );
  return installed?.isLegacy ?? false;
}
