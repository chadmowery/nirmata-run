import type { ShellUpgrades } from '../profile';

export const SHELL_UPGRADE_MULTIPLIERS = {
  speed: 5,
  armor: 1,
  stability: 10,
  additionalPorts: 1,
} as const;

export interface ShellStatBonuses {
  speed: number;
  armor: number;
  stability: number;
}

/**
 * Calculates raw stat bonuses from upgrade levels.
 * Stored values in profile are strictly upgrade levels (0..5 for stats, 0..3 for ports).
 */
export function calculateShellStatBonuses(
  upgrades?: Partial<ShellUpgrades>,
): ShellStatBonuses {
  return {
    speed: (upgrades?.speed ?? 0) * SHELL_UPGRADE_MULTIPLIERS.speed,
    armor: (upgrades?.armor ?? 0) * SHELL_UPGRADE_MULTIPLIERS.armor,
    stability: (upgrades?.stability ?? 0) * SHELL_UPGRADE_MULTIPLIERS.stability,
  };
}

/**
 * Computes effective shell stats by adding upgrade bonuses to archetype base stats.
 */
export function calculateEffectiveShellStats(
  baseStats: { speed: number; armor: number; stability: number; maxHealth: number },
  upgrades?: Partial<ShellUpgrades>,
): { speed: number; armor: number; stability: number; maxHealth: number } {
  const bonuses = calculateShellStatBonuses(upgrades);
  return {
    speed: baseStats.speed + bonuses.speed,
    armor: baseStats.armor + bonuses.armor,
    stability: baseStats.stability + bonuses.stability,
    maxHealth: baseStats.maxHealth,
  };
}

/**
 * Computes effective port capacities across firmware, augment, and software ports.
 */
export function calculateEffectivePortConfig(
  basePorts: { maxFirmware: number; maxAugment: number; maxSoftware: number },
  upgrades?: Partial<ShellUpgrades>,
): { maxFirmware: number; maxAugment: number; maxSoftware: number } {
  const additional =
    (upgrades?.additionalPorts ?? 0) * SHELL_UPGRADE_MULTIPLIERS.additionalPorts;
  return {
    maxFirmware: basePorts.maxFirmware + additional,
    maxAugment: basePorts.maxAugment + additional,
    maxSoftware: basePorts.maxSoftware + additional,
  };
}
