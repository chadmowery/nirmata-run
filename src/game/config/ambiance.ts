import ambianceData from './ambiance.json';

export interface AmbianceSceneTrack {
  cueId: string;
  samplePath?: string;
  description?: string;
}

export interface AmbianceDepthBand {
  id: string;
  label: string;
  floorRange: {
    min: number;
    max: number;
  };
  cueId: string;
  samplePath?: string;
  baseVolume: number;
  description?: string;
}

export interface AmbianceSectorCondition {
  condition: string;
  cueId?: string;
  samplePath?: string;
  cutoffMultiplier: number;
  resonanceQ: number;
  description?: string;
}

export interface AmbianceDuckingConfig {
  stabilityAnchorCutoffHz: number;
  pauseMenuCutoffHz: number;
  duckingRampDurationSec: number;
  crossfadeDurationSec: number;
}

export interface AmbianceConfig {
  scenes: Record<string, AmbianceSceneTrack>;
  depthBands: AmbianceDepthBand[];
  sectorConditions: AmbianceSectorCondition[];
  ducking: AmbianceDuckingConfig;
}

export interface ResolvedAmbiance {
  cueId: string;
  depthBand: string;
  baseVolume: number;
  cutoffMultiplier: number;
  resonanceQ: number;
}

let currentAmbianceConfig: AmbianceConfig = {
  scenes: { ...ambianceData.scenes },
  depthBands: [...ambianceData.depthBands],
  sectorConditions: [...ambianceData.sectorConditions],
  ducking: { ...ambianceData.ducking },
};

export function getAmbianceConfig(): AmbianceConfig {
  return currentAmbianceConfig;
}

export function setAmbianceConfig(config: AmbianceConfig): void {
  currentAmbianceConfig = config;
}

/**
 * Resolves the active ambiance cue, depth band label, base volume, and DSP multipliers
 * for a given floor number and active sector condition, completely eliminating hardcoded IDs.
 */
export function resolveAmbianceForFloor(
  floorNumber: number,
  sectorCondition?: string | null,
): ResolvedAmbiance {
  const config = currentAmbianceConfig;

  // 1. Find matching depth band by floor range
  let matchedBand = config.depthBands.find(
    (b) => floorNumber >= b.floorRange.min && floorNumber <= b.floorRange.max,
  );

  // Fallback if floor is below min or above max
  if (!matchedBand && config.depthBands.length > 0) {
    if (floorNumber < config.depthBands[0].floorRange.min) {
      matchedBand = config.depthBands[0];
    } else {
      matchedBand = config.depthBands[config.depthBands.length - 1];
    }
  }

  let cueId = matchedBand ? matchedBand.cueId : 'amb_band_1_corrupted';
  const depthBand = matchedBand ? matchedBand.label : 'CORRUPTED_DATA';
  const baseVolume = matchedBand ? matchedBand.baseVolume : 0.6;
  let cutoffMultiplier = 1.0;
  let resonanceQ = 1.0;

  // 2. Check sector condition modifiers and track overrides
  if (sectorCondition) {
    const condConfig = config.sectorConditions.find(
      (c) => c.condition.toUpperCase() === sectorCondition.toUpperCase(),
    );
    if (condConfig) {
      if (condConfig.cueId && condConfig.cueId.trim().length > 0) {
        cueId = condConfig.cueId.trim();
      }
      if (typeof condConfig.cutoffMultiplier === 'number') {
        cutoffMultiplier = condConfig.cutoffMultiplier;
      }
      if (typeof condConfig.resonanceQ === 'number') {
        resonanceQ = condConfig.resonanceQ;
      }
    }
  }

  return {
    cueId,
    depthBand,
    baseVolume,
    cutoffMultiplier,
    resonanceQ,
  };
}
