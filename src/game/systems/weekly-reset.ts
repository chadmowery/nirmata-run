import { loadProfile, saveProfile, PlayerProfile } from './profile-persistence';
import { applyLegacyToProfile } from './legacy-code';
import economyConfig from '../entities/templates/economy.json';

export interface ResetResult {
  sessionId: string;
  wasReset: boolean;
  previousWeekSeed: number;
  newWeekSeed: number;
  blueprintsDeleted: number;
  itemsLegacied: number;
  upgradesReset: number;
  winnersItem: string;
  walletAfterCap: { scrap: number; flux: number };
}

/**
 * Get the Winner's Item for a given week index.
 * Cycles through the curated rotation list (per D-22).
 */
export function getWinnersItem(weekIndex: number): string {
  const items = economyConfig.winnersItems;
  return items[weekIndex % items.length];
}

/**
 * Execute Format C: weekly reset on a player profile (per BP-04, D-17, D-18, D-19, D-20).
 *
 * 1. Delete all uninstalled Blueprints from library (BP-04)
 * 2. Mark all installed items as Legacy (D-17 Firmware, D-18 Augments)
 * 3. Reset Shell upgrades to base (D-19)
 * 4. Preserve currency with cap enforcement (D-20)
 * 5. Update weekSeed
 * 6. Return Winner's Item (D-22, BP-07)
 */
export async function executeWeeklyReset(
  sessionId: string,
  newWeekSeed: number
): Promise<ResetResult> {
  const profile = await loadProfile(sessionId);
  if (!profile) {
    throw new Error(`Profile not found: ${sessionId}`);
  }

  // Idempotency check (per Pitfall 6)
  if (profile.weekSeed === newWeekSeed) {
    return {
      sessionId,
      wasReset: false,
      previousWeekSeed: profile.weekSeed,
      newWeekSeed,
      blueprintsDeleted: 0,
      itemsLegacied: 0,
      upgradesReset: 0,
      winnersItem: getWinnersItem(newWeekSeed),
      walletAfterCap: { ...profile.wallet },
    };
  }

  const previousWeekSeed = profile.weekSeed;

  // 1. Delete all uninstalled Blueprints (BP-04)
  // Blueprint compilation gate means uninstalled ones are just library entries.
  // The plan says: "Weekly reset deletes all uninstalled Blueprints from library per BP-04"
  // So we keep blueprintIds that are in installedItems.
  const installedBlueprintIds = new Set(
    profile.installedItems.map(i => i.blueprintId)
  );
  
  const originalLibrarySize = profile.blueprintLibrary.length;
  profile.blueprintLibrary = profile.blueprintLibrary.filter(b => 
    installedBlueprintIds.has(b.blueprintId)
  );
  const blueprintsDeleted = originalLibrarySize - profile.blueprintLibrary.length;

  // 2. Mark all installed items as Legacy (D-17, D-18)
  const itemsLegacied = profile.installedItems.length;
  applyLegacyToProfile(profile);

  // 3. Reset Shell upgrades (D-19)
  const upgradesReset = Object.keys(profile.shellUpgrades).length;
  profile.shellUpgrades = {};

  // 4. Enforce currency caps (D-20)
  profile.wallet.scrap = Math.min(profile.wallet.scrap, economyConfig.caps.scrap);
  profile.wallet.flux = Math.min(profile.wallet.flux, economyConfig.caps.flux);

  // 5. Reset attempt tracking (D-15)
  profile.attemptTracking.weeklyAttemptUsed = false;
  profile.attemptTracking.weekNumber = newWeekSeed;

  // 6. Update weekSeed
  profile.weekSeed = newWeekSeed;

  // 6. Determine Winner's Item (D-22, BP-07)
  const winnersItem = getWinnersItem(newWeekSeed);

  await saveProfile(profile);

  return {
    sessionId,
    wasReset: true,
    previousWeekSeed,
    newWeekSeed,
    blueprintsDeleted,
    itemsLegacied,
    upgradesReset,
    winnersItem,
    walletAfterCap: { ...profile.wallet },
  };
}
