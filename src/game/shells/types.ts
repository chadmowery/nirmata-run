/**
 * Base stats for a Shell.
 */
export interface ShellStats {
  speed: number;
  stability: number;
  armor: number;
  maxHealth: number;
}

/**
 * Port configuration for a Shell.
 */
export interface PortConfig {
  maxFirmware: number;
  maxAugment: number;
  maxSoftware: number;
}

/**
 * Represents a stat/port bonus applied during a Shell upgrade.
 */
export interface ShellUpgrade {
  level: number;
  statBonuses?: Partial<ShellStats>;
  portBonuses?: Partial<PortConfig>;
}

/**
 * Raw template for a Shell as defined in JSON.
 */
export interface ShellTemplate {
  id: string;
  name: string;
  baseStats: ShellStats;
  basePorts: PortConfig;
  upgrades: ShellUpgrade[];
}

/**
 * Current state of a specific Shell instance.
 */
export interface ShellRecord {
  id: string;
  archetypeId: string;
  level: number;
  currentStats: ShellStats;
  portConfig: PortConfig;
}
