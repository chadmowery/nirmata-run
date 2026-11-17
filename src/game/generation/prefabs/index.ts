import { RoomPrefabTemplate } from './types';
import { FactionTheme } from '@shared/components/environment';
import serverCore from './server-core.json';
import freightBay from './freight-bay.json';
import deconAirlock from './decon-airlock.json';
import zeroDayVault from './zero-day-vault.json';

export * from './types';

export const ALL_PREFABS: RoomPrefabTemplate[] = [
  serverCore as RoomPrefabTemplate,
  freightBay as RoomPrefabTemplate,
  deconAirlock as RoomPrefabTemplate,
  zeroDayVault as RoomPrefabTemplate,
];

/**
 * Get qualifying prefabs for a given floor depth and optional faction.
 */
export function getPrefabsForFloor(
  depth: number,
  faction?: FactionTheme,
): RoomPrefabTemplate[] {
  const matching = ALL_PREFABS.filter((p) => {
    const floorMatch = depth >= p.minFloor && depth <= p.maxFloor;
    if (!floorMatch) return false;
    // Vault rooms can spawn for any faction on floors 6-15
    if (p.isVaultRoom) return true;
    if (!faction || faction === 'system') return true;
    return p.faction === faction;
  });

  if (matching.length > 0) return matching;

  // Fallback to any prefab matching floor depth if active faction has no bespoke prefab authored yet
  return ALL_PREFABS.filter((p) => depth >= p.minFloor && depth <= p.maxFloor);
}

/**
 * Registers or updates a room prefab template in memory (used by dev hotload).
 */
export function upsertPrefab(prefab: RoomPrefabTemplate): void {
  const idx = ALL_PREFABS.findIndex((p) => p.id === prefab.id);
  if (idx >= 0) {
    ALL_PREFABS[idx] = prefab;
  } else {
    ALL_PREFABS.push(prefab);
  }
}

/**
 * Removes a room prefab template from the in-memory registry (used by dev hotload).
 */
export function removePrefab(id: string): void {
  const idx = ALL_PREFABS.findIndex((p) => p.id === id);
  if (idx >= 0) {
    ALL_PREFABS.splice(idx, 1);
  }
}
