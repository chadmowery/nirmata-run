import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Sprite, Container, Assets } from 'pixi.js';

// Mock PixiJS
vi.mock('pixi.js', () => {
  return {
    Sprite: vi.fn().mockImplementation(function() {
      return {
        width: 0,
        height: 0,
        removeFromParent: vi.fn(),
        destroy: vi.fn(),
      };
    }),
    Container: vi.fn().mockImplementation(function() {
      return {
        addChild: vi.fn(),
      };
    }),
    Assets: {
      get: vi.fn().mockReturnValue({}), // Mock texture
    },
  };
});

import { createEntitySprite, getEntitySprite, getSpriteCount, clearAllSprites } from '../../src/rendering/sprite-map';

describe('Entity Sprite Map', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearAllSprites();
  });

  it('should create a new sprite and add it to the container', () => {
    const mockContainer = new Container();
    const entityId = 1;
    const spriteKey = 'player';

    const sprite = createEntitySprite(entityId, spriteKey, mockContainer);

    expect(sprite).toBeDefined();
    expect(mockContainer.addChild).toHaveBeenCalledWith(sprite);
    expect(getSpriteCount()).toBe(1);
    expect(getEntitySprite(entityId)).toBe(sprite);
  });

  it('should return the same sprite if called with the same entityId', () => {
    const mockContainer = new Container();
    const entityId = 1;
    
    const sprite1 = createEntitySprite(entityId, 'player', mockContainer);
    const sprite2 = createEntitySprite(entityId, 'player', mockContainer);

    expect(sprite1).toBe(sprite2);
    expect(getSpriteCount()).toBe(1);
    expect(mockContainer.addChild).toHaveBeenCalledTimes(1);
  });

  it('should return undefined for non-existent entities', () => {
    expect(getEntitySprite(999)).toBeUndefined();
  });
});
