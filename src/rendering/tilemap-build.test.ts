import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildTilemap, clearTilemap } from './tilemap';
import { TILE_SIZE } from './constants';

// Mock PixiJS
vi.mock('pixi.js', () => {
  const Sprite = vi.fn().mockImplementation(function() {
    return {
      x: 0,
      y: 0,
      alpha: 1,
      visible: true,
      texture: {},
      destroy: vi.fn(),
    };
  });
  const Container = vi.fn().mockImplementation(function() {
    return {
      addChild: vi.fn(),
      removeChild: vi.fn(),
    };
  });
  const Texture = {
    // Hardcode 16 for TILE_SIZE here to avoid hoisting ReferenceError
    from: vi.fn().mockReturnValue({ width: 16, height: 16 }),
  };
  return {
    Sprite,
    Container,
    Texture,
  };
});

import { Sprite, Container, Texture } from 'pixi.js';

describe('buildTilemap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearTilemap(new Container()); // Clear the module-level spritePool
  });

  it('should create sprites for every grid cell when no options provided', () => {
    const grid = {
      width: 2,
      height: 2,
      getTile: vi.fn((x, y) => ({ terrain: 'floor', walkable: true })),
    };
    const mockContainer = new Container();

    buildTilemap(grid as any, mockContainer);

    // 2x2 = 4 tiles
    expect(mockContainer.addChild).toHaveBeenCalledTimes(4);
    
    // Verify first sprite positioning
    const firstSprite = (mockContainer.addChild as any).mock.calls[0][0];
    expect(firstSprite.x).toBe(0 * TILE_SIZE);
    expect(firstSprite.y).toBe(0 * TILE_SIZE);
    expect(Texture.from).toHaveBeenCalledWith('floor');
  });

  it('should only render tiles within visibleRange', () => {
    const grid = {
      width: 10,
      height: 10,
      getTile: vi.fn((x, y) => ({ terrain: 'floor', walkable: true })),
    };
    const mockContainer = new Container();
    const options = {
      visibleRange: { startX: 1, startY: 1, endX: 2, endY: 2 },
    };

    buildTilemap(grid as any, mockContainer, options);

    // 2x2 area = 4 tiles
    expect(mockContainer.addChild).toHaveBeenCalledTimes(4);
    expect(grid.getTile).toHaveBeenCalledWith(1, 1);
    expect(grid.getTile).not.toHaveBeenCalledWith(0, 0);
  });

  it('should set alpha based on fovSet and exploredSet', () => {
    const grid = {
      width: 3,
      height: 1,
      getTile: vi.fn((x, y) => ({ terrain: 'floor', walkable: true })),
    };
    const mockContainer = new Container();
    const options = {
      fovSet: new Set(['0,0']),
      exploredSet: new Set(['1,0']),
    };

    buildTilemap(grid as any, mockContainer, options);

    // 3 calls to getTile
    // (0,0) is in FOV -> visible
    // (1,0) is explored -> visible
    // (2,0) is neither -> skipped (alpha 0)
    
    expect(mockContainer.addChild).toHaveBeenCalledTimes(2);
    
    const sprite1 = (mockContainer.addChild as any).mock.calls[0][0];
    expect(sprite1.alpha).toBe(1.0);
    
    const sprite2 = (mockContainer.addChild as any).mock.calls[1][0];
    expect(sprite2.alpha).toBe(0.3);
  });

  it('should map terrain types to correct textures', () => {
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
    const mockContainer = new Container();

    buildTilemap(grid as any, mockContainer);

    expect(Texture.from).toHaveBeenCalledWith('floor');
    expect(Texture.from).toHaveBeenCalledWith('wall');
    expect(Texture.from).toHaveBeenCalledWith('door');
  });
});
