export interface CompilationCosts {
  common: number;
  uncommon: number;
  rare: number;
  legendary: number;
}

export interface InstallationCosts {
  firmware: number;
  augment: number;
}

export interface ShellUpgradeCostConfig {
  baseCost: number;
  perLevelMultiplier: number;
}

export interface ShellPortUpgradeCostConfig {
  baseCost: number;
  perPortMultiplier: number;
}

export interface ShellUpgradeCosts {
  speed: ShellUpgradeCostConfig;
  armor: ShellUpgradeCostConfig;
  additionalPort: ShellPortUpgradeCostConfig;
  stability?: ShellUpgradeCostConfig;
}

export interface DropRateConfig {
  min: number;
  max: number;
  chance: number;
}

export interface BlueprintDropConfig {
  chance: number;
}

export interface CurrencyDrops {
  scrap: Record<string, DropRateConfig>;
  flux: Record<string, DropRateConfig>;
  blueprint: Record<string, BlueprintDropConfig>;
}

export interface ScoringWeights {
  floorReached: number;
  scrapCollected: number;
  enemiesDefeated: number;
  softwareExtracted: number;
  fluxExtracted: number;
}

export interface ShopConfig {
  stockSize: number;
  maxRarity: string;
}

export interface EconomyConfig {
  version: string;
  currencyDrops: CurrencyDrops;
  costs: {
    compilation: CompilationCosts;
    installation: InstallationCosts;
    shellUpgrade: ShellUpgradeCosts;
  };
  caps: Record<string, number>;
  pity: Record<string, number>;
  shop: ShopConfig;
  conversion: Record<string, number>;
  scoring: ScoringWeights;
  winnersItems: string[];
}
