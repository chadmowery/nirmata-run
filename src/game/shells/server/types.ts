import type { LightAnimationType, LightSourceData } from '@shared/components/light-source';
import type { CardinalDirectionSuffix, ShellDirectionalSprites } from '@shared/utils/shell-sprite-util';

export type { CardinalDirectionSuffix, ShellDirectionalSprites };

export interface ShellLightSourceOverride {
  enabled?: boolean;
  color?: string;
  intensity?: number;
  radius?: number;
  height?: number;
  falloff?: number;
  castsShadows?: boolean;
  offsetX?: number;
  offsetY?: number;
  animation?: {
    type?: LightAnimationType | string;
    speed?: number;
    amplitude?: number;
    secondaryColor?: string;
  };
}

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
  starterLoadout?: string[];
  sprite?: string;
  directionalSprites?: ShellDirectionalSprites;
  defaultDirection?: CardinalDirectionSuffix | string;
  lightSource?: ShellLightSourceOverride | Partial<LightSourceData>;
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
  starterLoadout?: string[];
  sprite?: string;
  directionalSprites?: ShellDirectionalSprites;
  defaultDirection?: CardinalDirectionSuffix | string;
  lightSource?: ShellLightSourceOverride | Partial<LightSourceData>;
}
