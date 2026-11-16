import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SpriteAnimator } from '@/rendering/sprite-animator';
import { inferThemeIdFromAssetFilename } from '@/server/dev/asset-watcher';
import { GET as getAnimations, PUT as putAnimations } from '@/app/api/dev/gamedata/tileset/animations/route';
import type { ThemedTilesetManifest } from '@shared/tileset-types';

describe('Sprite, Animation & Atlas Hotloading (HOTLOAD-03)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('infers canonical themeId from public/assets filenames', () => {
    expect(inferThemeIdFromAssetFilename('tileset.png')).toBe('default');
    expect(inferThemeIdFromAssetFilename('tileset_n.png')).toBe('default');
    expect(inferThemeIdFromAssetFilename('tileset_m.png')).toBe('default');
    expect(inferThemeIdFromAssetFilename('tileset.json')).toBe('default');
    expect(inferThemeIdFromAssetFilename('tileset_traxus_foundry.png')).toBe('traxus_foundry');
    expect(inferThemeIdFromAssetFilename('tileset_traxus_foundry_n.png')).toBe('traxus_foundry');
    expect(inferThemeIdFromAssetFilename('tileset_sekiguchi_biolabs_m.png')).toBe('sekiguchi_biolabs');
    expect(inferThemeIdFromAssetFilename('tileset_dark_subnet.json')).toBe('dark_subnet');
  });

  it('SpriteAnimator.hotUpdateAnimations updates clips and resets lastRenderedFrameKey', () => {
    const animator = new SpriteAnimator();
    const manifest: ThemedTilesetManifest = {
      frames: {
        hero_a: { frame: { x: 0, y: 0, w: 32, h: 32 }, sourceSize: { w: 32, h: 32 }, spriteSourceSize: { x: 0, y: 0, w: 32, h: 32 } },
        hero_b: { frame: { x: 32, y: 0, w: 32, h: 32 }, sourceSize: { w: 32, h: 32 }, spriteSourceSize: { x: 0, y: 0, w: 32, h: 32 } },
      },
      animations: {
        hero_a: { idle: { frames: ['hero_a'], fps: 4, loop: 'loop' } },
      },
      meta: {
        themeId: 'default',
        themeName: 'Default',
        image: 'tileset.png',
        format: 'RGBA8888',
        size: { w: 512, h: 512 },
        scale: 1,
        tileSize: 32,
      },
    };
    animator.setCustomManifest(manifest);
    const state = animator.registerEntity(10, { key: 'hero_a' });
    state.lastRenderedFrameKey = 'hero_a';

    animator.hotUpdateAnimations('default', {
      hero_a: { idle: { frames: ['hero_a', 'hero_b'], fps: 12, loop: 'pingpong' } },
    });

    expect(state.lastRenderedFrameKey).toBe('');
    const updatedClip = animator.getClip('hero_a', 'idle');
    expect(updatedClip?.frames).toEqual(['hero_a', 'hero_b']);
    expect(updatedClip?.fps).toBe(12);
    expect(updatedClip?.loop).toBe('pingpong');
  });

  it('GET /api/dev/gamedata/tileset/animations returns manifest animations & frameKeys', async () => {
    const res = await getAnimations(
      new Request('http://localhost/api/dev/gamedata/tileset/animations?theme=default'),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.themeId).toBe('default');
    expect(Array.isArray(data.frameKeys)).toBe(true);
    expect(data.frameKeys.length).toBeGreaterThan(0);
    expect(typeof data.animations).toBe('object');
  });

  it('PUT /api/dev/gamedata/tileset/animations rejects unknown frame keys', async () => {
    const req = new Request('http://localhost/api/dev/gamedata/tileset/animations', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        themeId: 'default',
        animSetKey: 'test_unit',
        entry: {
          idle: {
            frames: ['definitely_missing_frame_key_xyz'],
            fps: 6,
            loop: 'loop',
          },
        },
      }),
    });

    const res = await putAnimations(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('Unknown frame key');
  });
});
