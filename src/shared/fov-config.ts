import { z } from 'zod';

export const ActiveFovSettingsSchema = z.object({
  /** Base player sight radius in tiles (replaces hardcoded FOV_RADIUS = 8). */
  baseRadius: z.number().int().min(2).max(24).default(8),
  /** Minimum sight radius in tiles after sector condition penalties. */
  minRadius: z.number().int().min(1).max(12).default(2),
  /** Radius reduction in tiles when FloorState.sectorCondition === 'DARK_SUBNET'. */
  darkSubnetRadiusPenalty: z.number().int().min(0).max(10).default(2),
  /** Texture filtering on the fovMaskTexture: 'linear' (smooth gradient shroud) or 'nearest' (crisp tile steps). */
  filterMode: z.enum(['linear', 'nearest']).default('linear'),
  /** Lower smoothstep threshold on fovMask where direct/specular point lights begin illuminating active FOV. */
  activeLightGateMin: z.number().min(0.0).max(1.0).default(0.25),
  /** Upper smoothstep threshold on fovMask where direct/specular point lights reach 100% intensity. */
  activeLightGateMax: z.number().min(0.05).max(1.0).default(0.6),
  /** Lower smoothstep threshold blending from Explored FOW colour into fully lit Active FOV colour. */
  activeBlendMin: z.number().min(0.0).max(1.0).default(0.25),
  /** Upper smoothstep threshold completing the blend into Active FOV colour. */
  activeBlendMax: z.number().min(0.05).max(1.0).default(0.72),
});

export const FogOfWarSettingsSchema = z.object({
  /** Normalized mask value (0.05..0.90) written to fovMaskTexture for explored out-of-FOV tiles (default 0.25 -> R=64). */
  exploredMaskValue: z.number().min(0.05).max(0.9).default(0.25),
  /** Color desaturation factor for explored FOW tiles (0.0 = original color, 0.65 = cold desaturated default, 1.0 = pure monochrome). */
  desaturation: z.number().min(0.0).max(1.0).default(0.65),
  /** Cold memory silhouette RGB tint hex applied to explored FOW tiles (default '#172136'). */
  tintHex: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#172136'),
  /** Master brightness multiplier on explored FOW memory tiles. */
  brightnessMultiplier: z.number().min(0.0).max(4.0).default(1.0),
  /** Minimum clamped memory ambient scale in dark sectors. */
  minMemoryScale: z.number().min(0.0).max(2.0).default(0.35),
  /** Maximum clamped memory ambient scale in bright sectors. */
  maxMemoryScale: z.number().min(0.05).max(3.0).default(1.0),
  /** Self-illumination retention factor for emissive pixels (neon, terminals) inside explored FOW. */
  emissiveRetention: z.number().min(0.0).max(1.0).default(0.06),
  /** Outer smoothstep threshold where Unexplored Void begins transitioning into Explored FOW. */
  voidRevealMin: z.number().min(0.0).max(0.5).default(0.01),
  /** Inner smoothstep threshold where Explored FOW reaches full memory opacity. */
  voidRevealMax: z.number().min(0.01).max(0.8).default(0.18),
  /** Background shroud color hex for unexplored void tiles (default '#000000'). */
  voidColorHex: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#000000'),
});

export const FovEntityVisibilitySettingsSchema = z.object({
  /** Sprite alpha for remembered props and ground items inside explored FOW (0.05..1.0). */
  rememberedPropAlpha: z.number().min(0.05).max(1.0).default(1.0),
  /** Alpha multiplier applied to props once searched (default 0.6). */
  searchedPropAlphaMultiplier: z.number().min(0.1).max(1.0).default(0.6),
  /** Fallback tile/prop alpha for explored FOW when deferred lighting is disabled (default 0.35). */
  unlitFallbackFowAlpha: z.number().min(0.05).max(1.0).default(0.35),
});

export const FovConfigSchema = z.object({
  version: z.string().default('1.0.0'),
  fov: ActiveFovSettingsSchema,
  fow: FogOfWarSettingsSchema,
  entities: FovEntityVisibilitySettingsSchema,
});
export type FovConfig = z.infer<typeof FovConfigSchema>;

export const DEFAULT_FOV_CONFIG: FovConfig = {
  version: '1.0.0',
  fov: {
    baseRadius: 8,
    minRadius: 2,
    darkSubnetRadiusPenalty: 2,
    filterMode: 'linear',
    activeLightGateMin: 0.25,
    activeLightGateMax: 0.6,
    activeBlendMin: 0.25,
    activeBlendMax: 0.72,
  },
  fow: {
    exploredMaskValue: 0.25,
    desaturation: 0.65,
    tintHex: '#172136',
    brightnessMultiplier: 1.0,
    minMemoryScale: 0.35,
    maxMemoryScale: 1.0,
    emissiveRetention: 0.06,
    voidRevealMin: 0.01,
    voidRevealMax: 0.18,
    voidColorHex: '#000000',
  },
  entities: {
    rememberedPropAlpha: 1.0,
    searchedPropAlphaMultiplier: 0.6,
    unlitFallbackFowAlpha: 0.35,
  },
};

let activeFovConfig: FovConfig = structuredClone(DEFAULT_FOV_CONFIG);

export function getActiveFovConfig(): FovConfig {
  return activeFovConfig;
}

export function setActiveFovConfig(config: FovConfig): void {
  const parsed = FovConfigSchema.safeParse(config);
  if (parsed.success) {
    activeFovConfig = parsed.data;
  } else {
    activeFovConfig = config;
  }
}
