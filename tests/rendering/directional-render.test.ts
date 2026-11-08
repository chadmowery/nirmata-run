import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolveTerrainTile, buildTilemap, clearTilemap } from '../../src/rendering/tilemap';
import { getTextureForSpriteKey, resolveFallbackSpriteKey, updateEntitySpriteOrientation } from '../../src/rendering/sprite-map';
import { loadThemedAssets, getActiveThemeId, THEME_MANIFEST_MAP } from '../../src/rendering/assets';
import { Grid } from '../../src/engine/grid/grid';

vi.mock('pixi.js', () => {
  const Sprite = vi.fn().mockImplementation(function () {
    return {
      x: 0,
      y: 0,
      alpha: 1,
      visible: true,
      texture: {},
      pivot: {
        x: 0,
        y: 0,
        set: vi.fn(function (this: { x: number; y: number }, px: number, py: number) {
          this.x = px;
          this.y = py;
        }),
      },
      rotation: 0,
      destroy: vi.fn(),
    };
  });
  const Container = vi.fn().mockImplementation(function () {
    return {
      addChild: vi.fn(),
      removeChild: vi.fn(),
    };
  });
  const Texture = {
    from: vi.fn((key: string) => ({ key, width: 32, height: 32 })),
    EMPTY: {},
  };
  const Assets = {
    add: vi.fn(),
    load: vi.fn(async (path: string) => ({ path })),
    unload: vi.fn(async () => {}),
    get: vi.fn((key: string) => {
      if (key === 'tileset_research_lab') {
        return {
          textures: {
            wall_horizontal: { key: 'research_wall_horizontal', width: 32, height: 32 },
          },
        };
      }
      return null;
    }),
  };
  return {
    Sprite,
    Container,
    Texture,
    Assets,
  };
});

import { Sprite, Container, Texture, Assets } from 'pixi.js';

describe('Directional Tilemaps & Themed Rendering (Milestone 4)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('resolveFallbackSpriteKey', () => {
    it('maps directional wall frames to base wall', () => {
      expect(resolveFallbackSpriteKey('wall_horizontal')).toBe('wall');
      expect(resolveFallbackSpriteKey('wall_vertical')).toBe('wall');
      expect(resolveFallbackSpriteKey('wall_corner_ne')).toBe('wall');
      expect(resolveFallbackSpriteKey('wall_cap_n')).toBe('wall');
      expect(resolveFallbackSpriteKey('wall_cross')).toBe('wall');
    });

    it('maps directional door frames to base door', () => {
      expect(resolveFallbackSpriteKey('door_closed_horizontal')).toBe('door');
      expect(resolveFallbackSpriteKey('door_closed_vertical')).toBe('door');
      expect(resolveFallbackSpriteKey('door_open_horizontal')).toBe('door');
      expect(resolveFallbackSpriteKey('door_open_vertical')).toBe('door');
    });

    it('maps directional props to base isotropic prop', () => {
      expect(resolveFallbackSpriteKey('prop_workstation_n')).toBe('prop_workstation');
      expect(resolveFallbackSpriteKey('prop_workstation_e')).toBe('prop_workstation');
      expect(resolveFallbackSpriteKey('prop_locker_s')).toBe('prop_locker');
      expect(resolveFallbackSpriteKey('prop_vault_door_w')).toBe('prop_vault_door');
      expect(resolveFallbackSpriteKey('prop_crate_cover_h')).toBe('prop_crate_cover');
    });

    it('returns undefined for non-directional keys', () => {
      expect(resolveFallbackSpriteKey('floor')).toBeUndefined();
      expect(resolveFallbackSpriteKey('player')).toBeUndefined();
    });
  });

  describe('resolveTerrainTile autotiling', () => {
    it('resolves horizontal wall correctly from grid connectivity', () => {
      const grid = new Grid(3, 3);
      // Floor everywhere
      for (let y = 0; y < 3; y++) {
        for (let x = 0; x < 3; x++) {
          grid.setTile(x, y, { terrain: 'floor', walkable: true });
        }
      }
      // Wall horizontal line across middle row
      grid.setTile(0, 1, { terrain: 'wall', walkable: false });
      grid.setTile(1, 1, { terrain: 'wall', walkable: false });
      grid.setTile(2, 1, { terrain: 'wall', walkable: false });

      const centerTile = resolveTerrainTile(grid, 1, 1);
      // East (2) + West (8) = 10 -> wall_straight_h
      expect(centerTile.frameKey).toBe('wall_straight_h');
      expect(centerTile.fallbackFrame).toBe('wall');
    });

    it('resolves door orientation correctly from neighboring walls', () => {
      const grid = new Grid(3, 3);
      for (let y = 0; y < 3; y++) {
        for (let x = 0; x < 3; x++) {
          grid.setTile(x, y, { terrain: 'floor', walkable: true });
        }
      }
      // Wall East and West of center door
      grid.setTile(0, 1, { terrain: 'wall', walkable: false });
      grid.setTile(1, 1, { terrain: 'door', walkable: false });
      grid.setTile(2, 1, { terrain: 'wall', walkable: false });

      const doorTile = resolveTerrainTile(grid, 1, 1);
      expect(doorTile.frameKey).toBe('door_h_closed');
      expect(doorTile.fallbackFrame).toBe('door');
    });
  });

  describe('updateEntitySpriteOrientation', () => {
    it('applies rotation angle and center pivot for rotated sprite', () => {
      const sprite = new Sprite();
      updateEntitySpriteOrientation(sprite as any, 90);

      expect(sprite.pivot.set).toHaveBeenCalledWith(16, 16);
      expect(sprite.rotation).toBeCloseTo(Math.PI / 2);
    });

    it('resets pivot and rotation to zero for angle 0', () => {
      const sprite = new Sprite();
      updateEntitySpriteOrientation(sprite as any, 0);

      expect(sprite.pivot.set).toHaveBeenCalledWith(0, 0);
      expect(sprite.rotation).toBe(0);
    });
  });

  describe('getTextureForSpriteKey & Themed Assets', () => {
    it('fetches texture from active themed atlas when available', async () => {
      await loadThemedAssets('research_lab');
      expect(getActiveThemeId()).toBe('research_lab');

      const texture = getTextureForSpriteKey('wall_horizontal');
      expect((texture as any).key).toBe('research_wall_horizontal');

      // Reset back to default
      await loadThemedAssets('default');
      expect(getActiveThemeId()).toBe('default');
    });

    it('falls back to base frame when specific directional frame is missing from atlas', () => {
      // In default theme, wall_corner_ne is not in atlas, falls back to Texture.from('wall')
      const texture = getTextureForSpriteKey('wall_corner_ne');
      expect(Texture.from).toHaveBeenCalledWith('wall');
    });
  });
});
