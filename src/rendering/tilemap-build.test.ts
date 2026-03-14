import { describe, it, expect, vi } from 'vitest';
import { buildTilemap } from '../../src/rendering/tilemap';
import { TILE_SIZE } from '../../src/rendering/constants';

describe('buildTilemap', () => {
  it('should call tilemap.tile for every grid cell when no options provided', () => {
    const grid = {
      width: 2,
      height: 2,
      getTile: vi.fn((x, y) => ({ terrain: 'floor', walkable: true })),
    };
    const tilemap = {
      clear: vi.fn(),
      tile: vi.fn(),
    };

    buildTilemap(grid as any, tilemap as any);

    expect(tilemap.clear).toHaveBeenCalled();
    expect(tilemap.tile).toHaveBeenCalledTimes(4);
    expect(tilemap.tile).toHaveBeenCalledWith('floor', 0, 0, { alpha: 1 });
    expect(tilemap.tile).toHaveBeenCalledWith('floor', TILE_SIZE, TILE_SIZE, { alpha: 1 });
  });

  it('should only render tiles within visibleRange', () => {
    const grid = {
      width: 10,
      height: 10,
      getTile: vi.fn((x, y) => ({ terrain: 'floor', walkable: true })),
    };
    const tilemap = {
      clear: vi.fn(),
      tile: vi.fn(),
    };
    const options = {
      visibleRange: { startX: 1, startY: 1, endX: 2, endY: 2 },
    };

    buildTilemap(grid as any, tilemap as any, options);

    // 2x2 area = 4 tiles
    expect(tilemap.tile).toHaveBeenCalledTimes(4);
    expect(grid.getTile).toHaveBeenCalledWith(1, 1);
    expect(grid.getTile).not.toHaveBeenCalledWith(0, 0);
  });

  it('should set alpha based on fovSet and exploredSet', () => {
    const grid = {
      width: 3,
      height: 1,
      getTile: vi.fn((x, y) => ({ terrain: 'floor', walkable: true })),
    };
    const tilemap = {
      clear: vi.fn(),
      tile: vi.fn(),
    };
    const options = {
      fovSet: new Set(['0,0']),
      exploredSet: new Set(['1,0']),
    };

    buildTilemap(grid as any, tilemap as any, options);

    // (0,0) is in FOV -> alpha 1.0
    expect(tilemap.tile).toHaveBeenCalledWith('floor', 0, 0, { alpha: 1.0 });
    // (1,0) is explored -> alpha 0.3
    expect(tilemap.tile).toHaveBeenCalledWith('floor', TILE_SIZE, 0, { alpha: 0.3 });
    // (2,0) is neither -> alpha 0 (tile not called)
    expect(tilemap.tile).toHaveBeenCalledTimes(2);
  });

  it('should map terrain types to correct frames', () => {
    const grid = {
      width: 3,
      height: 1,
      getTile: vi.fn((x, y) => {
        if (x === 0) return { terrain: 'floor', walkable: true };
        if (x === 1) return { terrain: 'wall', walkable: false };
        if (x === 2) return { terrain: 'door', walkable: true };
        return undefined;
      }),
    };
    const tilemap = {
      clear: vi.fn(),
      tile: vi.fn(),
    };

    buildTilemap(grid as any, tilemap as any);

    expect(tilemap.tile).toHaveBeenCalledWith('floor', 0, 0, { alpha: 1 });
    expect(tilemap.tile).toHaveBeenCalledWith('wall', TILE_SIZE, 0, { alpha: 1 });
    expect(tilemap.tile).toHaveBeenCalledWith('door', TILE_SIZE * 2, 0, { alpha: 1 });
  });
});
