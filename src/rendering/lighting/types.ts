import type { FactionTheme, SectorCondition } from '@shared/components/environment';
import type { LightAnimationType, LightSourceData } from '@shared/components/light-source';
import { VIEWPORT_H, VIEWPORT_W } from '../constants';

export const GBUFFER_WIDTH = VIEWPORT_W;
export const GBUFFER_HEIGHT = VIEWPORT_H;
export const MAX_PRIMARY_LIGHTS = 64;
export const MAX_MICRO_LIGHTS = 64;
export const MAX_GBUFFER_QUADS = 2048;

export interface FactionAmbientProfile {
  colorHex: string;
  rgb: [number, number, number];
  intensity: number;
}

export interface SectorConditionVisualProfile {
  ambientScale: number;
  floorPulseHz: number;
  floorPulseRgb: [number, number, number];
  tintRgb: [number, number, number];
  shadowTintRgb: [number, number, number];
  fogHex?: string;
  propBeaconIntervalSec?: number;
  jitter?: number;
}

export interface RenderLightDescriptor {
  screenX: number;
  screenY: number;
  radiusPx: number;
  intensity: number;
  colorRgb: [number, number, number];
  heightPx: number;
  falloff: number;
  castsShadows: boolean;
  isBeaconPing: boolean;
}

export interface MicroLightDescriptor {
  screenX: number;
  screenY: number;
  radiusPx: number;
  intensity: number;
  colorRgb: [number, number, number];
}

export interface ParticleGbufferDescriptor {
  worldX: number;
  worldY: number;
  size: number;
  colorRgb: [number, number, number];
  alpha: number;
  mode: 'emissive' | 'normal_lit';
  heightPx: number;
  shadowOpacity: number;
}

export interface TransientLightInstance {
  id: number;
  worldX: number;
  worldY: number;
  colorHex: string;
  colorRgb: [number, number, number];
  intensity: number;
  radiusPx: number;
  heightPx: number;
  falloff: number;
  castsShadows: boolean;
  remainingMs: number;
  durationMs: number;
  isBeaconPing?: boolean;
}

export interface LightingTelemetry {
  enabled: boolean;
  primaryLightCount: number;
  microLightCount: number;
  shadowCasterLightCount: number;
  gbufferQuads: number;
  activeFactionTheme: string;
  activeSectorCondition: string | null;
  fovGridWidth: number;
  fovGridHeight: number;
}

export interface LightAnimationEvaluation {
  intensityMultiplier: number;
  colorRgb: [number, number, number];
  angleOffsetRad: number;
}

/**
 * Parses a `#RRGGBB` string to normalized `[r, g, b]` (`0..1`).
 */
export function parseHexColorNormalized(hex: string): [number, number, number] {
  const cleaned = hex.trim().replace(/^#/, '');
  if (cleaned.length !== 6) return [1, 1, 1];
  const n = Number.parseInt(cleaned, 16);
  if (Number.isNaN(n)) return [1, 1, 1];
  return [((n >> 16) & 0xff) / 255, ((n >> 8) & 0xff) / 255, (n & 0xff) / 255];
}

const DEFAULT_CYBERACME_PROFILE: FactionAmbientProfile = {
  colorHex: '#0d1528',
  rgb: parseHexColorNormalized('#0d1528'),
  intensity: 0.24,
};

const TRAXUS_PROFILE: FactionAmbientProfile = {
  colorHex: '#261109',
  rgb: parseHexColorNormalized('#261109'),
  intensity: 0.26,
};

const SEKIGUCHI_PROFILE: FactionAmbientProfile = {
  colorHex: '#091e20',
  rgb: parseHexColorNormalized('#091e20'),
  intensity: 0.25,
};

const DARK_SUBNET_PROFILE: FactionAmbientProfile = {
  colorHex: '#03050a',
  rgb: parseHexColorNormalized('#03050a'),
  intensity: 0.07,
};

const NUCALORIC_PROFILE: FactionAmbientProfile = {
  colorHex: '#101b24',
  rgb: parseHexColorNormalized('#101b24'),
  intensity: 0.22,
};

export const FACTION_AMBIENT_PROFILES: Record<string, FactionAmbientProfile> = {
  default: DEFAULT_CYBERACME_PROFILE,
  cyberacme: DEFAULT_CYBERACME_PROFILE,
  system: DEFAULT_CYBERACME_PROFILE,
  traxus: TRAXUS_PROFILE,
  traxus_foundry: TRAXUS_PROFILE,
  sekiguchi: SEKIGUCHI_PROFILE,
  sekiguchi_biolabs: SEKIGUCHI_PROFILE,
  dark_subnet: DARK_SUBNET_PROFILE,
  nucaloric: NUCALORIC_PROFILE,
};

export const SECTOR_CONDITION_VISUAL_PROFILES: Record<
  SectorCondition,
  SectorConditionVisualProfile
> = {
  NOMINAL: {
    ambientScale: 1.0,
    floorPulseHz: 0,
    floorPulseRgb: [0, 0, 0],
    tintRgb: [1, 1, 1],
    shadowTintRgb: parseHexColorNormalized('#0d1528'),
  },
  THERMAL_SURGE: {
    ambientScale: 1.0,
    floorPulseHz: 0.8,
    floorPulseRgb: parseHexColorNormalized('#ff4d00'),
    tintRgb: parseHexColorNormalized('#ff7733'),
    shadowTintRgb: parseHexColorNormalized('#3a0d05'),
  },
  DARK_SUBNET: {
    ambientScale: 0.35,
    floorPulseHz: 0,
    floorPulseRgb: [0, 0, 0],
    tintRgb: parseHexColorNormalized('#4da6ff'),
    shadowTintRgb: parseHexColorNormalized('#03050a'),
    fogHex: '#020409',
    propBeaconIntervalSec: 3.0,
  },
  OVERCLOCKED_GRID: {
    ambientScale: 0.85,
    floorPulseHz: 0,
    floorPulseRgb: [0, 0, 0],
    tintRgb: parseHexColorNormalized('#a855f7'),
    shadowTintRgb: parseHexColorNormalized('#180828'),
    jitter: 0.25,
  },
};

export function resolveFactionAmbientProfile(
  theme?: FactionTheme | string | null,
): FactionAmbientProfile {
  if (!theme) return DEFAULT_CYBERACME_PROFILE;
  return FACTION_AMBIENT_PROFILES[theme] ?? DEFAULT_CYBERACME_PROFILE;
}

/**
 * Evaluates procedural waveforms (`STATIC`, `PULSE`, `FLICKER`, `STROBE`, `RADAR_SWEEP`)
 * per DEFERRED-LIGHTING-RENDERING.md §3.5 deterministically from elapsed time & entity phase offset.
 */
export function evaluateLightAnimation(
  light: Pick<LightSourceData, 'color' | 'animation'>,
  timeSec: number,
  entityPhaseOffset: number = 0,
): LightAnimationEvaluation {
  const baseRgb = parseHexColorNormalized(light.color);
  const anim = light.animation;
  if (!anim || anim.type === 'STATIC') {
    return { intensityMultiplier: 1.0, colorRgb: baseRgb, angleOffsetRad: 0 };
  }

  const speed = anim.speed ?? 1.0;
  const amp = anim.amplitude ?? 0.25;
  const phase = timeSec * speed + entityPhaseOffset;
  const type: LightAnimationType = anim.type;

  if (type === 'PULSE') {
    const wave = 0.5 + 0.5 * Math.sin(phase * Math.PI * 2);
    const mult = Math.max(0.05, 1.0 - amp + amp * wave * 2.0 * 0.5);
    if (anim.secondaryColor) {
      const secRgb = parseHexColorNormalized(anim.secondaryColor);
      return {
        intensityMultiplier: mult,
        colorRgb: [
          baseRgb[0] * (1 - wave) + secRgb[0] * wave,
          baseRgb[1] * (1 - wave) + secRgb[1] * wave,
          baseRgb[2] * (1 - wave) + secRgb[2] * wave,
        ],
        angleOffsetRad: 0,
      };
    }
    return { intensityMultiplier: mult, colorRgb: baseRgb, angleOffsetRad: 0 };
  }

  if (type === 'FLICKER') {
    // High-frequency stepped pseudo-noise deterministic wave
    const step = Math.floor(phase * 14.0);
    const h = Math.sin(step * 12.9898 + 78.233) * 43758.5453;
    const rand = h - Math.floor(h);
    // Occasional micro-brownout dip
    const dip = rand < 0.14 ? 0.35 : 0.72 + rand * 0.28;
    const mult = Math.max(0.1, 1.0 - amp + amp * dip);
    return { intensityMultiplier: mult, colorRgb: baseRgb, angleOffsetRad: 0 };
  }

  if (type === 'STROBE') {
    const frac = phase - Math.floor(phase);
    const mult = frac < 0.22 ? 1.0 + amp * 0.8 : Math.max(0.08, 0.2 - amp * 0.1);
    return { intensityMultiplier: mult, colorRgb: baseRgb, angleOffsetRad: 0 };
  }

  // RADAR_SWEEP
  const angle = phase * Math.PI * 2;
  const sweepPulse = 0.75 + 0.25 * Math.max(0, Math.cos(angle));
  const mult = Math.max(0.2, 1.0 - amp * 0.5 + amp * 0.5 * sweepPulse);
  return { intensityMultiplier: mult, colorRgb: baseRgb, angleOffsetRad: angle };
}
