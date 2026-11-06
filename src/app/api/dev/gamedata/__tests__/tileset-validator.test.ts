import { describe, it, expect } from 'vitest';
import {
  validateTilesetManifest,
  REQUIRED_WALL_AUTOTILE_FRAMES,
  REQUIRED_DOOR_FRAMES,
  REQUIRED_DIRECTIONAL_PROP_FRAMES,
} from '../tileset-validator';

describe('tileset-validator', () => {
  const createMockFrame = (w = 32, h = 32) => ({
    frame: { x: 0, y: 0, w, h },
    sourceSize: { w, h },
    spriteSourceSize: { x: 0, y: 0, w, h },
  });

  const createBaseManifest = (themeId = 'traxus') => {
    const frames: Record<string, ReturnType<typeof createMockFrame>> = {
      floor: createMockFrame(),
      wall: createMockFrame(),
      door: createMockFrame(),
    };
    return {
      frames,
      meta: {
        themeId,
        themeName: 'Traxus Heavy Industry',
        image: 'tileset.png',
        format: 'RGBA8888',
        size: { w: 512, h: 512 },
        scale: 1,
        tileSize: 32,
      },
    };
  };

  it('validates a complete directional manifest successfully without warnings', () => {
    const manifest = createBaseManifest();

    // Populate all required directional frames
    for (const frame of REQUIRED_WALL_AUTOTILE_FRAMES) {
      manifest.frames[frame] = createMockFrame();
    }
    for (const frame of REQUIRED_DOOR_FRAMES) {
      manifest.frames[frame] = createMockFrame();
    }
    for (const frame of REQUIRED_DIRECTIONAL_PROP_FRAMES) {
      manifest.frames[frame] = createMockFrame();
    }

    const result = validateTilesetManifest(manifest);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
    expect(result.missingDirectionalFrames).toHaveLength(0);
    expect(result.presentDirectionalFrames.length).toBeGreaterThan(20);
  });

  it('flags warnings when directional frames are missing, but marks valid if schema passes', () => {
    const manifest = createBaseManifest();
    const result = validateTilesetManifest(manifest);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.missingDirectionalFrames).toContain('wall_cap_s');
    expect(result.missingDirectionalFrames).toContain('prop_workstation_e');
    expect(result.warnings.some((w) => w.includes("wall_cap_s"))).toBe(true);
  });

  it('flags errors when frame dimensions do not match meta tileSize', () => {
    const manifest = createBaseManifest();
    manifest.frames['misaligned_tile'] = createMockFrame(48, 48); // 48x48 instead of 32x32

    const result = validateTilesetManifest(manifest);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("misaligned_tile"))).toBe(true);
  });

  it('rejects invalid manifest schemas missing meta or frames', () => {
    const invalidManifest = {
      meta: { image: 'test.png' },
    };

    const result = validateTilesetManifest(invalidManifest);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
