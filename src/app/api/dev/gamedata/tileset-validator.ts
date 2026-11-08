import fs from 'fs/promises';
import path from 'path';
import { ThemedTilesetManifestSchema, AnimationClipDef } from '@shared/tileset-types';
import { resolveFallbackSpriteKey } from '@rendering/sprite-map';

export const REQUIRED_WALL_AUTOTILE_FRAMES = [
  'wall_single',
  'wall_cap_n',
  'wall_cap_e',
  'wall_cap_s',
  'wall_cap_w',
  'wall_straight_h',
  'wall_straight_v',
  'wall_corner_ne',
  'wall_corner_se',
  'wall_corner_sw',
  'wall_corner_nw',
  'wall_t_n',
  'wall_t_e',
  'wall_t_s',
  'wall_t_w',
  'wall_cross',
] as const;

export const REQUIRED_DOOR_FRAMES = [
  'door_h_closed',
  'door_v_closed',
  'door_h_open',
  'door_v_open',
] as const;

export const REQUIRED_DIRECTIONAL_PROP_FRAMES = [
  'prop_workstation_n',
  'prop_workstation_e',
  'prop_workstation_s',
  'prop_workstation_w',
  'prop_locker_n',
  'prop_locker_e',
  'prop_locker_s',
  'prop_locker_w',
  'prop_biocabinet_n',
  'prop_biocabinet_e',
  'prop_biocabinet_s',
  'prop_biocabinet_w',
  'prop_vault_door_n',
  'prop_vault_door_e',
  'prop_vault_door_s',
  'prop_vault_door_w',
  'prop_crate_cover_h',
  'prop_crate_cover_v',
] as const;

export const ALL_DIRECTIONAL_FRAMES = [
  ...REQUIRED_WALL_AUTOTILE_FRAMES,
  ...REQUIRED_DOOR_FRAMES,
  ...REQUIRED_DIRECTIONAL_PROP_FRAMES,
];

export interface TilesetValidationResult {
  valid: boolean;
  themeId: string;
  errors: string[];
  warnings: string[];
  totalFrames: number;
  missingDirectionalFrames: string[];
  presentDirectionalFrames: string[];
  totalAnimations: number;
  animatedKeys: string[];
}

/**
 * Validates a parsed tileset manifest object against ThemedTilesetManifestSchema
 * and checks for directional frame coverage and dimensional alignment.
 */
export function validateTilesetManifest(manifest: unknown): TilesetValidationResult {
  const parseResult = ThemedTilesetManifestSchema.safeParse(manifest);
  if (!parseResult.success) {
    const errorMessages = parseResult.error.issues.map(
      (issue) => `${issue.path.join('.')}: ${issue.message}`,
    );
    return {
      valid: false,
      themeId: 'unknown',
      errors: errorMessages,
      warnings: [],
      totalFrames: 0,
      missingDirectionalFrames: [...ALL_DIRECTIONAL_FRAMES],
      presentDirectionalFrames: [],
      totalAnimations: 0,
      animatedKeys: [],
    };
  }

  const data = parseResult.data;
  const themeId = data.meta.themeId;
  const expectedTileSize = data.meta.tileSize ?? 32;
  const errors: string[] = [];
  const warnings: string[] = [];
  const missingDirectionalFrames: string[] = [];
  const presentDirectionalFrames: string[] = [];

  const frameKeys = new Set(Object.keys(data.frames));

  // 1. Validate frame dimensions
  for (const [key, frameDef] of Object.entries(data.frames)) {
    if (frameDef.frame.w !== expectedTileSize || frameDef.frame.h !== expectedTileSize) {
      errors.push(
        `Frame '${key}' dimensions (${frameDef.frame.w}x${frameDef.frame.h}) do not match meta tileSize (${expectedTileSize}x${expectedTileSize})`,
      );
    }
  }

  // 2. Check directional frame coverage
  for (const dirFrame of ALL_DIRECTIONAL_FRAMES) {
    if (frameKeys.has(dirFrame)) {
      presentDirectionalFrames.push(dirFrame);
    } else {
      missingDirectionalFrames.push(dirFrame);
      const fallback = resolveFallbackSpriteKey(dirFrame) ?? 'isotropic base';
      warnings.push(
        `Directional frame '${dirFrame}' is missing from theme '${themeId}'; will fall back to '${fallback}' or sprite rotation.`,
      );
    }
  }

  // 3. Validate animation definitions if present
  const animations = data.animations ?? {};
  const animatedKeys = Object.keys(animations);
  const totalAnimations = animatedKeys.length;

  for (const [animKey, entry] of Object.entries(animations)) {
    const clips: Array<{ state: string; clip: AnimationClipDef }> = [];
    if ('frames' in entry && Array.isArray((entry as AnimationClipDef).frames)) {
      clips.push({ state: 'idle', clip: entry as AnimationClipDef });
    } else {
      for (const [state, clip] of Object.entries(entry)) {
        if (clip && typeof clip === 'object' && 'frames' in clip) {
          clips.push({ state, clip: clip as AnimationClipDef });
        }
      }
    }

    for (const { state, clip } of clips) {
      // VAL-ANIM-03 (Duration Array Alignment)
      if (clip.frameDurationsMs !== undefined) {
        if (clip.frameDurationsMs.length !== clip.frames.length) {
          errors.push(
            `Animation '${animKey}' clip '${state}' has frameDurationsMs length ${clip.frameDurationsMs.length} which does not match frames length ${clip.frames.length}`,
          );
        }
      }

      for (const frameKey of clip.frames) {
        // VAL-ANIM-01 (Frame Reference Integrity)
        if (!frameKeys.has(frameKey)) {
          errors.push(
            `Animation '${animKey}' clip '${state}' references missing frame '${frameKey}'`,
          );
        } else {
          // VAL-ANIM-02 (Atlas Bounds Check)
          const frameDef = data.frames[frameKey];
          if (frameDef) {
            const { x, y, w, h } = frameDef.frame;
            if (
              x < 0 ||
              y < 0 ||
              x + w > data.meta.size.w ||
              y + h > data.meta.size.h
            ) {
              errors.push(
                `Animation '${animKey}' clip '${state}' frame '${frameKey}' bounds (${x},${y},${w},${h}) exceed atlas dimensions (${data.meta.size.w}x${data.meta.size.h})`,
              );
            }
          }
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    themeId,
    errors,
    warnings,
    totalFrames: frameKeys.size,
    missingDirectionalFrames,
    presentDirectionalFrames,
    totalAnimations,
    animatedKeys,
  };
}

/**
 * Reads and validates a theme tileset JSON file from the filesystem.
 */
export async function validateThemeFile(themeId: string): Promise<TilesetValidationResult> {
  let filePath =
    themeId === 'default'
      ? path.join(process.cwd(), 'public/assets/tileset.json')
      : path.join(process.cwd(), `public/assets/tileset_${themeId}.json`);

  try {
    await fs.access(filePath);
  } catch {
    const fallbackPath = path.join(process.cwd(), `public/assets/themes/${themeId}/tileset.json`);
    try {
      await fs.access(fallbackPath);
      filePath = fallbackPath;
    } catch {
      // Keep original filePath to report error below
    }
  }

  try {
    const rawContent = await fs.readFile(filePath, 'utf-8');
    const parsed = JSON.parse(rawContent);
    return validateTilesetManifest(parsed);
  } catch (err) {
    return {
      valid: false,
      themeId,
      errors: [err instanceof Error ? err.message : `Failed to load theme file at ${filePath}`],
      warnings: [],
      totalFrames: 0,
      missingDirectionalFrames: [...ALL_DIRECTIONAL_FRAMES],
      presentDirectionalFrames: [],
      totalAnimations: 0,
      animatedKeys: [],
    };
  }
}
