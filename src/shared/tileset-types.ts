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

export const AnimationLoopModeSchema = z.enum(['loop', 'pingpong', 'once']);
export type AnimationLoopMode = z.infer<typeof AnimationLoopModeSchema>;

export const AnimationStateKeySchema = z.enum([
  'idle',
  'move',
  'attack',
  'hit',
  'interact',
  'locked',
  'open',
  'searched',
  'corrupted',
  'death',
]);
export type AnimationStateKey = z.infer<typeof AnimationStateKeySchema>;

export const AnimationClipDefSchema = z.object({
  /** Ordered list of frame keys that must exist in `manifest.frames`. */
  frames: z.array(z.string()).min(1),
  /** Playback rate in frames per second (used when `frameDurationsMs` is omitted). */
  fps: z.number().positive().default(6),
  /** Playback loop mode: 'loop' (0..N-1), 'pingpong' (0..N-1..1), or 'once' (0..N-1 then hold/transition). */
  loop: AnimationLoopModeSchema.default('loop'),
  /** Optional explicit per-frame durations in milliseconds (must match `frames.length` if provided). */
  frameDurationsMs: z.array(z.number().int().positive()).optional(),
  /** Optional target state to transition into after a 'once' clip completes (defaults to ambient state). */
  nextState: AnimationStateKeySchema.optional(),
  /** When true (default for looping clips), desynchronizes initial phase by EntityId hash. */
  desyncPhase: z.boolean().default(true).optional(),
});
export type AnimationClipDef = z.infer<typeof AnimationClipDefSchema>;

/**
 * Multi-state animation mapping for an entity or prop archetype (e.g. { idle: Clip, move: Clip, attack: Clip }).
 */
export const EntityAnimationSetSchema = z.partialRecord(
  AnimationStateKeySchema,
  AnimationClipDefSchema,
);
export type EntityAnimationSet = z.infer<typeof EntityAnimationSetSchema>;

/**
 * An entry in `manifest.animations` can be either:
 * 1. A direct `AnimationClipDef` (shorthand for `{ idle: clip }`), OR
 * 2. An `EntityAnimationSet` mapping state keys (`idle`, `move`, `attack`, `hit`, `interact`, `searched`, etc.) to clips.
 */
export const AnimationManifestEntrySchema = z.union([
  AnimationClipDefSchema,
  EntityAnimationSetSchema,
]);
export type AnimationManifestEntry = z.infer<typeof AnimationManifestEntrySchema>;

export const ThemedTilesetManifestSchema = z.object({
  frames: z.record(z.string(), FrameDefSchema),
  /** Optional dictionary of animation clips or multi-state animation sets keyed by base sprite key or set ID. */
  animations: z.record(z.string(), AnimationManifestEntrySchema).optional(),
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
