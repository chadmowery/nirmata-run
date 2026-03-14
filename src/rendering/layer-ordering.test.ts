import { describe, it, expect, vi } from 'vitest';

// Mock PixiJS components
vi.mock('pixi.js', () => {
  return {
    Container: vi.fn().mockImplementation(function() {
      return {
        addChild: vi.fn(),
        children: [],
      };
    }),
  };
});

vi.mock('@pixi/tilemap', () => ({
  CompositeTilemap: vi.fn().mockImplementation(function() {
    return {};
  }),
}));

import { createWorldContainer } from '../../src/rendering/layers';

describe('createWorldContainer', () => {
  it('should create a world container with 4 ordered layers', () => {
    const { worldContainer, terrainLayer, itemLayer, entityLayer, effectsLayer } = createWorldContainer();

    expect(worldContainer).toBeDefined();
    expect(terrainLayer).toBeDefined();
    expect(itemLayer).toBeDefined();
    expect(entityLayer).toBeDefined();
    expect(effectsLayer).toBeDefined();

    // Verify addChild calls to ensure order
    const addChild = worldContainer.addChild as any;
    expect(addChild).toHaveBeenCalledTimes(4);
    expect(addChild.mock.calls[0][0]).toBe(terrainLayer);
    expect(addChild.mock.calls[1][0]).toBe(itemLayer);
    expect(addChild.mock.calls[2][0]).toBe(entityLayer);
    expect(addChild.mock.calls[3][0]).toBe(effectsLayer);
  });
});
