import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { ThemedTilesetManifestSchema } from '../tileset-types';

describe('ThemedTilesetManifestSchema (Milestone 1)', () => {
  it('validates public/assets/tileset.json against ThemedTilesetManifestSchema', () => {
    const raw = fs.readFileSync(path.join(process.cwd(), 'public/assets/tileset.json'), 'utf-8');
    const json = JSON.parse(raw);

    const parsed = ThemedTilesetManifestSchema.safeParse(json);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.meta.tileSize).toBe(32);
      expect(parsed.data.meta.themeId).toBe('default');
      expect(parsed.data.frames.floor).toBeDefined();
      expect(parsed.data.frames.floor.frame.w).toBe(32);
      expect(parsed.data.frames.floor.frame.h).toBe(32);
    }
  });

  it('validates custom themed manifest with orientation and fallbackFrame', () => {
    const custom = {
      frames: {
        wall_straight_h: {
          frame: { x: 0, y: 0, w: 32, h: 32 },
          sourceSize: { w: 32, h: 32 },
          spriteSourceSize: { x: 0, y: 0, w: 32, h: 32 },
          orientation: 'EAST',
          fallbackFrame: 'wall',
        },
      },
      meta: {
        themeId: 'traxus',
        themeName: 'Traxus Freight Bay',
        image: 'tileset_traxus.png',
        format: 'RGBA8888',
        size: { w: 256, h: 256 },
        scale: 1,
        tileSize: 32,
      },
    };

    const parsed = ThemedTilesetManifestSchema.safeParse(custom);
    expect(parsed.success).toBe(true);
  });
});
