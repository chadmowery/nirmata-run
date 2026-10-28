import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Sprite, Container, Texture, Assets } from 'pixi.js';

// Mock PixiJS
vi.mock('pixi.js', () => {
  const Sprite = vi.fn().mockImplementation(function () {
    return {
      width: 0,
      height: 0,
      removeFromParent: vi.fn(),
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

import {
  createEntitySprite,
  getEntitySprite,
  destroyEntitySprite,
  getSpriteCount,
  clearAllSprites,
} from '../../src/rendering/sprite-map';

describe('Entity Sprite Map & Lifecycle Cleanup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearAllSprites();
  });

  describe('Sprite Creation and Retrieval', () => {
    it('should create a new sprite and add it to the container', () => {
      const mockContainer = new Container();
      const entityId = 1;
      const spriteKey = 'player';

      const sprite = createEntitySprite(entityId, spriteKey, mockContainer);

      expect(sprite).toBeDefined();
      expect(mockContainer.addChild).toHaveBeenCalledWith(sprite);
      expect(getSpriteCount()).toBe(1);
    });

    it('should get an existing sprite by entity ID', () => {
      const mockContainer = new Container();
      const entityId = 1;
      const createdSprite = createEntitySprite(entityId, 'player', mockContainer);

      const retrievedSprite = getEntitySprite(entityId);

      expect(retrievedSprite).toBe(createdSprite);
    });

    it('should return undefined for a non-existent entity ID', () => {
      expect(getEntitySprite(999)).toBeUndefined();
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
  });

  describe('Sprite Destruction and Clearing', () => {
    it('should remove from parent, destroy, and delete from map on destroy', () => {
      const mockContainer = new Container();
      const entityId = 1;

      const sprite = createEntitySprite(entityId, 'player', mockContainer);

      destroyEntitySprite(entityId);

      expect(sprite.removeFromParent).toHaveBeenCalled();
      expect(sprite.destroy).toHaveBeenCalledWith({ children: true });
      expect(getEntitySprite(entityId)).toBeUndefined();
      expect(getSpriteCount()).toBe(0);
    });

    it('should do nothing when destroying non-existent entity', () => {
      expect(() => {
        destroyEntitySprite(999);
      }).not.toThrow();
      expect(getSpriteCount()).toBe(0);
    });

    it('should clear all sprites from map and destroy them', () => {
      const mockContainer = new Container();

      const sprite1 = createEntitySprite(1, 'player', mockContainer);
      const sprite2 = createEntitySprite(2, 'enemy', mockContainer);

      expect(getSpriteCount()).toBe(2);

      clearAllSprites();

      expect(sprite1.removeFromParent).toHaveBeenCalled();
      expect(sprite1.destroy).toHaveBeenCalledWith({ children: true });
      expect(sprite2.removeFromParent).toHaveBeenCalled();
      expect(sprite2.destroy).toHaveBeenCalledWith({ children: true });
      expect(getSpriteCount()).toBe(0);
    });

    it('should handle clearing an empty sprite map', () => {
      expect(() => {
        clearAllSprites();
      }).not.toThrow();
      expect(getSpriteCount()).toBe(0);
    });
  });
});
