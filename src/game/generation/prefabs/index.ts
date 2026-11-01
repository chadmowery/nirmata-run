import { RoomPrefabTemplate } from './types';
import { FactionTheme } from '@shared/components/environment';
import serverCore from './server-core.json';
import freightBay from './freight-bay.json';
import deconAirlock from './decon-airlock.json';
import zeroDayVault from './zero-day-vault.json';

export * from './types';

export const ALL_PREFABS: RoomPrefabTemplate[] = [
  serverCore as unknown as RoomPrefabTemplate,
  freightBay as unknown as RoomPrefabTemplate,
  deconAirlock as unknown as RoomPrefabTemplate,
  zeroDayVault as unknown as RoomPrefabTemplate,
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
