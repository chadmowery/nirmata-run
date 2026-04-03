import { getCurrentDailySeed, getCurrentWeeklySeed } from './seed-rotation';
import economy from '../entities/templates/economy.json';

export enum RunMode {
  SIMULATION = 'simulation',
  DAILY = 'daily',
  WEEKLY = 'weekly',
}

export interface RunModeConfig {
  mode: RunMode;
  name: string;
  description: string;
  attemptsPerPeriod: number | null; // null = unlimited
  deathPenalty: {
    loseInventory: boolean;
    loseInstalledItems: boolean;
    resetShellUpgrades: boolean;
    scrapPityPercent: number;
  };
  seed: string;
  isCompetitive: boolean;
  hasLeaderboard: boolean;
}

/**
 * Gets the configuration for a specific run mode.
 */
export async function getRunModeConfig(mode: RunMode): Promise<RunModeConfig> {
  switch (mode) {
    case RunMode.SIMULATION:
      return {
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

    case RunMode.DAILY:
      return {
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

    case RunMode.WEEKLY:
      return {
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

    default:
      throw new Error(`Invalid RunMode: ${mode}`);
  }
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
  const { scoring } = (economy as any);
  return (
    (stats.floorNumber * scoring.floorReached) +
    (stats.scrapExtracted * scoring.scrapCollected) +
    (stats.softwareExtracted * scoring.softwareExtracted) +
    (stats.fluxExtracted * scoring.fluxExtracted)
  );
}
