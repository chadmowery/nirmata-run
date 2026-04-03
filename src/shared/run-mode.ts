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
