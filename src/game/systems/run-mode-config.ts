import { RunMode, RunModeConfig } from '@shared/run-mode';
import { logger } from '@engine/utils/logger';
import { getCurrentDailySeed, getCurrentWeeklySeed } from '@/app/persistence/seed-rotation';
import economyRaw from '../entities/templates/economy.json';
import { EconomyConfig } from '@shared/economy-types';

const economy = economyRaw as unknown as EconomyConfig;

export { RunMode };
export type { RunModeConfig };

/**
 * Gets the configuration for a specific run mode.
 */
export async function getRunModeConfig(mode: RunMode): Promise<RunModeConfig> {
  let config: RunModeConfig;
  switch (mode) {
    case RunMode.SIMULATION:
      config = {
        mode: RunMode.SIMULATION,
        name: 'Neural Simulation',
        description: 'Randomized training run. No risk to shell upgrades.',
        attemptsPerPeriod: null,
        deathPenalty: {
          loseInventory: true,
          loseInstalledItems: true,
          resetShellUpgrades: false,
          scrapPityPercent: 0.25,
        },
        seed: Math.random().toString(36).substring(2, 10),
        isCompetitive: false,
        hasLeaderboard: false,
      };
      break;

    case RunMode.DAILY:
      config = {
        mode: RunMode.DAILY,
        name: 'Daily Challenge',
        description: 'Shared daily seed. Competitive leaderboard.',
        attemptsPerPeriod: null, // Daily allows multiple practice runs? 
                                // Actually D-02 says "Simulation = random, Daily = shared seed"
        deathPenalty: {
          loseInventory: true,
          loseInstalledItems: true,
          resetShellUpgrades: false,
          scrapPityPercent: 0.25,
        },
        seed: await getCurrentDailySeed(),
        isCompetitive: true,
        hasLeaderboard: true,
      };
      break;

    case RunMode.WEEKLY:
      config = {
        mode: RunMode.WEEKLY,
        name: 'Weekly One-Shot',
        description: 'The definitive challenge. Exactly ONE life per week.',
        attemptsPerPeriod: 1,
        deathPenalty: {
          loseInventory: true,
          loseInstalledItems: true,
          resetShellUpgrades: true, // Weekly is high stakes
          scrapPityPercent: 0.25,
        },
        seed: await getCurrentWeeklySeed(),
        isCompetitive: true,
        hasLeaderboard: true,
      };
      break;

    default:
      throw new Error(`Invalid RunMode: ${mode}`);
  }

  logger.info(`Run Mode Config Loaded: ${config.name} (Seed: ${config.seed})`, 'SYSTEM');
  return config;
}

/**
 * Calculates server-side score based on run stats.
 * D-21: Scores never client-submitted.
 */
export function calculateScore(stats: {
  floorNumber: number;
  scrapExtracted: number;
  softwareExtracted: number;
  fluxExtracted: number;
}): number {
  const { scoring } = economy;
  return (
    (stats.floorNumber * scoring.floorReached) +
    (stats.scrapExtracted * scoring.scrapCollected) +
    (stats.softwareExtracted * scoring.softwareExtracted) +
    (stats.fluxExtracted * scoring.fluxExtracted)
  );
}
