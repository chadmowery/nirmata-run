import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Sprite, Container } from 'pixi.js';

// Mock PixiJS
vi.mock('pixi.js', () => {
  const Sprite = vi.fn().mockImplementation(function() {
    return {
      width: 0,
      height: 0,
      removeFromParent: vi.fn(),
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
    from: vi.fn().mockReturnValue({ width: 16, height: 16 }),
  };
  return {
    Sprite,
    Container,
    Texture,
    Assets: {
      get: vi.fn().mockReturnValue({}), // Mock texture
    },
  };
});

import { createEntitySprite, destroyEntitySprite, getSpriteCount, clearAllSprites, getEntitySprite } from '../../src/rendering/sprite-map';

describe('Sprite Cleanup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearAllSprites();
  });

  it('should remove from parent, destroy, and delete from map on destroy', () => {
    const mockContainer = new Container();
    const entityId = 1;

    const sprite = createEntitySprite(entityId, 'player', mockContainer);

    destroyEntitySprite(entityId);

    expect(sprite.removeFromParent).toHaveBeenCalled();
    expect(sprite.destroy).toHaveBeenCalledWith({ children: true });
    expect(getSpriteCount()).toBe(0);
    expect(getEntitySprite(entityId)).toBeUndefined();
  });

  it('should do nothing when destroying a non-existent entity', () => {
    expect(() => destroyEntitySprite(999)).not.toThrow();
  });

  it('should clean up all sprites when clearAllSprites is called', () => {
    const mockContainer = new Container();
    createEntitySprite(1, 'player', mockContainer);
    createEntitySprite(2, 'enemy', mockContainer);
    createEntitySprite(3, 'item', mockContainer);

    expect(getSpriteCount()).toBe(3);

    clearAllSprites();

    expect(getSpriteCount()).toBe(0);
  });
});
