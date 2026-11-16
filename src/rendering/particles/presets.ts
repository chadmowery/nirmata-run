import { AIBehaviorType } from '@shared/components/ai-state';
import { parseHexColorNormalized } from '../lighting/types';

export type PooledParticleMode = 'emissive' | 'normal_lit';

export interface PersistentEmitterPreset {
  id: string;
  mode: PooledParticleMode;
  secondaryMode?: PooledParticleMode;
  secondaryChance?: number;
  colorHex: number;
  secondaryColorHex?: number;
  spawnIntervalMs: number;
  maxActiveFromEmitter: number;
  speedMin: number;
  speedMax: number;
  lifeMinMs: number;
  lifeMaxMs: number;
  sizeMin: number;
  sizeMax: number;
  gravity: number;
  bounceFactor: number;
  heightPx: number;
  shadowOpacity: number;
  microIntensity: number;
  microRadiusPx: number;
  upwardBias: number;
  orbitRadiusPx: number;
  orbitSpeedRadPerMs: number;
  horizontalSpanPx: number;
  verticalOffsetPx: number;
}

export interface BurstSpawnConfig {
  mode: PooledParticleMode;
  count: number;
  colorHex: number;
  secondaryColorHex?: number;
  speedMin: number;
  speedMax: number;
  spreadRad: number;
  baseAngleRad: number;
  lifeMinMs: number;
  lifeMaxMs: number;
  sizeMin: number;
  sizeMax: number;
  gravity: number;
  bounceFactor: number;
  heightPx: number;
  shadowOpacity: number;
  microIntensity: number;
  microRadiusPx: number;
  scatterRadiusPx?: number;
}

export function hexNumberToCss(colorHex: number): string {
  return `#${Math.max(0, colorHex & 0xffffff)
    .toString(16)
    .padStart(6, '0')}`;
}

export function hexNumberToRgbNormalized(colorHex: number): [number, number, number] {
  return parseHexColorNormalized(hexNumberToCss(colorHex));
}

export function getBehaviorColorHex(behaviorType: AIBehaviorType): number {
  switch (behaviorType) {
    case AIBehaviorType.NULL_POINTER:
    case AIBehaviorType.BUFFER_OVERFLOW:
      return 0x00f0ff;
    case AIBehaviorType.FRAGMENTER:
    case AIBehaviorType.LOGIC_LEAKER:
      return 0xff0055;
    case AIBehaviorType.SYSTEM_ADMIN:
    case AIBehaviorType.SEED_EATER:
      return 0xffffff;
    default:
      return 0x00f0ff;
  }
}

export function getPresetForBehavior(behaviorType: AIBehaviorType): PersistentEmitterPreset {
  switch (behaviorType) {
    case AIBehaviorType.NULL_POINTER:
    case AIBehaviorType.BUFFER_OVERFLOW:
      return {
        id: `enemy_${behaviorType}`,
        mode: 'emissive',
        colorHex: 0x00f0ff,
        secondaryColorHex: 0x38bdf8,
        spawnIntervalMs: 95,
        maxActiveFromEmitter: 14,
        speedMin: 0.015,
        speedMax: 0.045,
        lifeMinMs: 420,
        lifeMaxMs: 720,
        sizeMin: 2,
        sizeMax: 3.5,
        gravity: -0.00003,
        bounceFactor: 0,
        heightPx: 14,
        shadowOpacity: 0,
        microIntensity: 0.85,
        microRadiusPx: 36,
        upwardBias: -0.015,
        orbitRadiusPx: 0,
        orbitSpeedRadPerMs: 0,
        horizontalSpanPx: 18,
        verticalOffsetPx: 0,
      };

    case AIBehaviorType.FRAGMENTER:
    case AIBehaviorType.LOGIC_LEAKER:
      return {
        id: `enemy_${behaviorType}`,
        mode: 'emissive',
        colorHex: 0xff0055,
        secondaryColorHex: 0xff6b2b,
        spawnIntervalMs: 100,
        maxActiveFromEmitter: 14,
        speedMin: 0.018,
        speedMax: 0.04,
        lifeMinMs: 450,
        lifeMaxMs: 750,
        sizeMin: 2.5,
        sizeMax: 4,
        gravity: 0.00014,
        bounceFactor: 0.45,
        heightPx: 12,
        shadowOpacity: 0,
        microIntensity: 0.95,
        microRadiusPx: 40,
        upwardBias: -0.01,
        orbitRadiusPx: 0,
        orbitSpeedRadPerMs: 0,
        horizontalSpanPx: 16,
        verticalOffsetPx: -2,
      };

    case AIBehaviorType.SYSTEM_ADMIN:
    case AIBehaviorType.SEED_EATER:
      return {
        id: `enemy_${behaviorType}`,
        mode: 'emissive',
        colorHex: 0xffffff,
        secondaryColorHex: 0xa855f7,
        spawnIntervalMs: 80,
        maxActiveFromEmitter: 18,
        speedMin: 0.01,
        speedMax: 0.025,
        lifeMinMs: 550,
        lifeMaxMs: 900,
        sizeMin: 2,
        sizeMax: 3.5,
        gravity: 0,
        bounceFactor: 0,
        heightPx: 16,
        shadowOpacity: 0,
        microIntensity: 1.05,
        microRadiusPx: 46,
        upwardBias: 0,
        orbitRadiusPx: 10,
        orbitSpeedRadPerMs: 0.0045,
        horizontalSpanPx: 12,
        verticalOffsetPx: 0,
      };

    default:
      return {
        id: 'enemy_default',
        mode: 'emissive',
        colorHex: 0x00f0ff,
        spawnIntervalMs: 110,
        maxActiveFromEmitter: 12,
        speedMin: 0.015,
        speedMax: 0.035,
        lifeMinMs: 400,
        lifeMaxMs: 650,
        sizeMin: 2,
        sizeMax: 3,
        gravity: 0,
        bounceFactor: 0,
        heightPx: 12,
        shadowOpacity: 0,
        microIntensity: 0.75,
        microRadiusPx: 32,
        upwardBias: -0.008,
        orbitRadiusPx: 0,
        orbitSpeedRadPerMs: 0,
        horizontalSpanPx: 16,
        verticalOffsetPx: 0,
      };
  }
}

export function getPresetForProp(spriteKey: string): PersistentEmitterPreset | null {
  if (spriteKey.includes('cooling_vent')) {
    return {
      id: 'prop_cooling_vent_ready',
      mode: 'normal_lit',
      secondaryMode: 'emissive',
      secondaryChance: 0.22,
      colorHex: 0xa5f3fc,
      secondaryColorHex: 0x22d3ee,
      spawnIntervalMs: 120,
      maxActiveFromEmitter: 14,
      speedMin: 0.008,
      speedMax: 0.022,
      lifeMinMs: 700,
      lifeMaxMs: 1200,
      sizeMin: 4,
      sizeMax: 7.5,
      gravity: -0.000018,
      bounceFactor: 0,
      heightPx: 10,
      shadowOpacity: 0.15,
      microIntensity: 0.65,
      microRadiusPx: 28,
      upwardBias: -0.02,
      orbitRadiusPx: 0,
      orbitSpeedRadPerMs: 0,
      horizontalSpanPx: 14,
      verticalOffsetPx: -4,
    };
  }

  if (spriteKey.includes('capacitor_bank')) {
    return {
      id: 'prop_capacitor_bank',
      mode: 'emissive',
      colorHex: 0x38bdf8,
      secondaryColorHex: 0xe879f9,
      spawnIntervalMs: 85,
      maxActiveFromEmitter: 12,
      speedMin: 0.03,
      speedMax: 0.06,
      lifeMinMs: 160,
      lifeMaxMs: 280,
      sizeMin: 2,
      sizeMax: 3,
      gravity: 0,
      bounceFactor: 0,
      heightPx: 18,
      shadowOpacity: 0,
      microIntensity: 1.15,
      microRadiusPx: 42,
      upwardBias: 0,
      orbitRadiusPx: 0,
      orbitSpeedRadPerMs: 0,
      horizontalSpanPx: 13,
      verticalOffsetPx: -11,
    };
  }

  if (spriteKey === 'anchor' || spriteKey.includes('stabilizer')) {
    return {
      id: 'anchor_quantum_motes',
      mode: 'emissive',
      colorHex: 0x22d3ee,
      secondaryColorHex: 0x38bdf8,
      spawnIntervalMs: 100,
      maxActiveFromEmitter: 14,
      speedMin: 0.01,
      speedMax: 0.02,
      lifeMinMs: 650,
      lifeMaxMs: 1050,
      sizeMin: 2,
      sizeMax: 3.5,
      gravity: -0.000015,
      bounceFactor: 0,
      heightPx: 16,
      shadowOpacity: 0,
      microIntensity: 0.85,
      microRadiusPx: 34,
      upwardBias: -0.014,
      orbitRadiusPx: 9,
      orbitSpeedRadPerMs: 0.0038,
      horizontalSpanPx: 10,
      verticalOffsetPx: -2,
    };
  }

  return null;
}

export function createDamageBurstConfig(angleRad: number): BurstSpawnConfig {
  return {
    mode: 'emissive',
    count: 16,
    colorHex: 0xffaa33,
    secondaryColorHex: 0xff4500,
    speedMin: 0.045,
    speedMax: 0.11,
    spreadRad: Math.PI * 0.72,
    baseAngleRad: angleRad,
    lifeMinMs: 180,
    lifeMaxMs: 360,
    sizeMin: 2,
    sizeMax: 3.5,
    gravity: 0.00018,
    bounceFactor: 0.4,
    heightPx: 12,
    shadowOpacity: 0,
    microIntensity: 1.25,
    microRadiusPx: 44,
    scatterRadiusPx: 6,
  };
}

export function createVentSteamBurstConfig(): BurstSpawnConfig {
  return {
    mode: 'normal_lit',
    count: 14,
    colorHex: 0xfb923c,
    secondaryColorHex: 0xfdba74,
    speedMin: 0.018,
    speedMax: 0.042,
    spreadRad: Math.PI * 2,
    baseAngleRad: 0,
    lifeMinMs: 520,
    lifeMaxMs: 920,
    sizeMin: 5,
    sizeMax: 9,
    gravity: -0.000025,
    bounceFactor: 0,
    heightPx: 12,
    shadowOpacity: 0.15,
    microIntensity: 0,
    microRadiusPx: 0,
    scatterRadiusPx: 10,
  };
}

export function createVentEmberBurstConfig(): BurstSpawnConfig {
  return {
    mode: 'emissive',
    count: 10,
    colorHex: 0xff5e1a,
    secondaryColorHex: 0xfacc15,
    speedMin: 0.035,
    speedMax: 0.085,
    spreadRad: Math.PI * 2,
    baseAngleRad: 0,
    lifeMinMs: 240,
    lifeMaxMs: 460,
    sizeMin: 2,
    sizeMax: 3.5,
    gravity: 0.0001,
    bounceFactor: 0.3,
    heightPx: 14,
    shadowOpacity: 0,
    microIntensity: 1.05,
    microRadiusPx: 40,
    scatterRadiusPx: 8,
  };
}

export function createCryoSpillShardBurstConfig(): BurstSpawnConfig {
  return {
    mode: 'emissive',
    count: 14,
    colorHex: 0x34d399,
    secondaryColorHex: 0xa7f3d0,
    speedMin: 0.04,
    speedMax: 0.095,
    spreadRad: Math.PI * 2,
    baseAngleRad: 0,
    lifeMinMs: 250,
    lifeMaxMs: 480,
    sizeMin: 2,
    sizeMax: 3.5,
    gravity: 0.00016,
    bounceFactor: 0.35,
    heightPx: 12,
    shadowOpacity: 0,
    microIntensity: 1.0,
    microRadiusPx: 40,
    scatterRadiusPx: 10,
  };
}

export function createCryoSpillMistBurstConfig(): BurstSpawnConfig {
  return {
    mode: 'normal_lit',
    count: 18,
    colorHex: 0x10b981,
    secondaryColorHex: 0x6ee7b7,
    speedMin: 0.006,
    speedMax: 0.02,
    spreadRad: Math.PI * 2,
    baseAngleRad: 0,
    lifeMinMs: 1100,
    lifeMaxMs: 1800,
    sizeMin: 7,
    sizeMax: 12,
    gravity: -0.000005,
    bounceFactor: 0,
    heightPx: 8,
    shadowOpacity: 0.15,
    microIntensity: 0,
    microRadiusPx: 0,
    scatterRadiusPx: 42,
  };
}

export function createEmpArcBurstConfig(): BurstSpawnConfig {
  return {
    mode: 'emissive',
    count: 22,
    colorHex: 0x00f0ff,
    secondaryColorHex: 0xa855f7,
    speedMin: 0.06,
    speedMax: 0.125,
    spreadRad: Math.PI * 2,
    baseAngleRad: 0,
    lifeMinMs: 190,
    lifeMaxMs: 380,
    sizeMin: 2.5,
    sizeMax: 4,
    gravity: 0,
    bounceFactor: 0,
    heightPx: 16,
    shadowOpacity: 0,
    microIntensity: 1.45,
    microRadiusPx: 52,
    scatterRadiusPx: 8,
  };
}
