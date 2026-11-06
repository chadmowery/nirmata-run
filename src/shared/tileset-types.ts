import { z } from 'zod';

export const RectSchema = z.object({
  x: z.number().int().min(0),
  y: z.number().int().min(0),
  w: z.number().int().positive(),
  h: z.number().int().positive(),
});
export type Rect = z.infer<typeof RectSchema>;

export const FrameDefSchema = z.object({
  frame: RectSchema,
  sourceSize: z.object({ w: z.number().int(), h: z.number().int() }),
  spriteSourceSize: RectSchema,
  /** Optional orientation metadata for directional frames */
  orientation: z.enum(['NORTH', 'EAST', 'SOUTH', 'WEST']).optional(),
  /** Canonical fallback frame key if this directional frame is missing */
  fallbackFrame: z.string().optional(),
});
export type FrameDef = z.infer<typeof FrameDefSchema>;

export const ThemedTilesetManifestSchema = z.object({
  frames: z.record(z.string(), FrameDefSchema),
  meta: z.object({
    themeId: z
      .enum(['default', 'traxus', 'cyberacme', 'sekiguchi', 'nucaloric', 'dark_subnet', 'traxus_foundry', 'sekiguchi_biolabs'])
      .default('default'),
    themeName: z.string().default('Default'),
    image: z.string(),
    format: z.string().default('RGBA8888'),
    size: z.object({ w: z.number().int(), h: z.number().int() }),
    scale: z.number().default(1),
    tileSize: z.number().int().default(32),
  }),
});
export type ThemedTilesetManifest = z.infer<typeof ThemedTilesetManifestSchema>;
