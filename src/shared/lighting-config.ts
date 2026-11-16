import { z } from 'zod';

export const FactionAmbientProfileConfigSchema = z.object({
  colorHex: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  intensity: z.number().min(0).max(2.0),
  bloomMultiplier: z.number().min(0).max(4.0),
});
export type FactionAmbientProfileConfig = z.infer<typeof FactionAmbientProfileConfigSchema>;

export const SectorConditionVisualProfileConfigSchema = z.object({
  ambientScale: z.number().min(0).max(3.0),
  bloomMultiplier: z.number().min(0).max(4.0),
  floorPulseHz: z.number().min(0).max(10.0),
  floorPulseHex: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  tintHex: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  shadowTintHex: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  fogHex: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  propBeaconIntervalSec: z.number().min(0.1).max(30).optional(),
  jitter: z.number().min(0).max(2.0).optional(),
});
export type SectorConditionVisualProfileConfig = z.infer<typeof SectorConditionVisualProfileConfigSchema>;

export const GlobalBloomConfigSchema = z.object({
  enabled: z.boolean().default(true),
  baseIntensity: z.number().min(0).max(3.0).default(0.72),
  threshold: z.number().min(0).max(2.0).default(0.88),
});
export type GlobalBloomConfig = z.infer<typeof GlobalBloomConfigSchema>;

export const LightingConfigSchema = z.object({
  version: z.string().default('1.0.0'),
  bloom: GlobalBloomConfigSchema,
  factionThemes: z.record(z.string(), FactionAmbientProfileConfigSchema),
  sectorConditions: z.record(z.string(), SectorConditionVisualProfileConfigSchema),
});
export type LightingConfig = z.infer<typeof LightingConfigSchema>;

export const DEFAULT_LIGHTING_CONFIG: LightingConfig = {
  version: '1.0.0',
  bloom: {
    enabled: true,
    baseIntensity: 0.72,
    threshold: 0.88,
  },
  factionThemes: {
    cyberacme: { colorHex: '#0d1528', intensity: 0.24, bloomMultiplier: 1.0 },
    traxus_foundry: { colorHex: '#261109', intensity: 0.26, bloomMultiplier: 1.15 },
    sekiguchi_biolabs: { colorHex: '#091e20', intensity: 0.25, bloomMultiplier: 1.1 },
    dark_subnet: { colorHex: '#03050a', intensity: 0.07, bloomMultiplier: 1.25 },
    nucaloric: { colorHex: '#1a0d1e', intensity: 0.18, bloomMultiplier: 1.1 },
  },
  sectorConditions: {
    NOMINAL: {
      ambientScale: 1.0,
      bloomMultiplier: 1.0,
      floorPulseHz: 0,
      floorPulseHex: '#000000',
      tintHex: '#ffffff',
      shadowTintHex: '#0d1528',
    },
    THERMAL_SURGE: {
      ambientScale: 1.0,
      bloomMultiplier: 1.35,
      floorPulseHz: 0.8,
      floorPulseHex: '#ff4d00',
      tintHex: '#ff7733',
      shadowTintHex: '#3a0d05',
    },
    DARK_SUBNET: {
      ambientScale: 0.35,
      bloomMultiplier: 1.5,
      floorPulseHz: 0,
      floorPulseHex: '#000000',
      tintHex: '#4da6ff',
      shadowTintHex: '#03050a',
      fogHex: '#020409',
      propBeaconIntervalSec: 3.0,
    },
    OVERCLOCKED_GRID: {
      ambientScale: 0.85,
      bloomMultiplier: 1.4,
      floorPulseHz: 0,
      floorPulseHex: '#000000',
      tintHex: '#a855f7',
      shadowTintHex: '#180828',
      jitter: 0.25,
    },
  },
};

let activeLightingConfig: LightingConfig = structuredClone(DEFAULT_LIGHTING_CONFIG);

export function getActiveLightingConfig(): LightingConfig {
  return activeLightingConfig;
}

export function setActiveLightingConfig(config: LightingConfig): void {
  const parsed = LightingConfigSchema.safeParse(config);
  if (parsed.success) {
    activeLightingConfig = parsed.data;
  } else {
    activeLightingConfig = config;
  }
}
