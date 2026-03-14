import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Sprite } from 'pixi.js';
import { queueMoveTween, tickAnimations, hasActiveAnimation, clearAnimations } from '../../src/rendering/animations';

describe('Movement Tweens', () => {
  const getMockSprite = (id: number) => {
    return mockSprites[id];
  };

  let mockSprites: Record<number, any> = {};

  beforeEach(() => {
    clearAnimations();
    mockSprites = {
      1: { x: 0, y: 0, destroyed: false }
    };
  });

  it('should interpolate position over 100ms', () => {
    const entityId = 1;
    // (0,0) -> (1,1) grid which is (0,0) -> (32,32) pixels
    queueMoveTween(entityId, 0, 0, 1, 1);

    expect(hasActiveAnimation(entityId)).toBe(true);

    // Initial state
    tickAnimations(0, getMockSprite);
    expect(mockSprites[1].x).toBe(0);
    expect(mockSprites[1].y).toBe(0);

    // Halfway (50ms)
    tickAnimations(50, getMockSprite);
    expect(mockSprites[1].x).toBe(16);
    expect(mockSprites[1].y).toBe(16);

    // Completion (another 50ms)
    tickAnimations(50, getMockSprite);
    expect(mockSprites[1].x).toBe(32);
    expect(mockSprites[1].y).toBe(32);

    // Animation should be removed
    expect(hasActiveAnimation(entityId)).toBe(false);
  });

  it('should remove animation if sprite is destroyed', () => {
    const entityId = 1;
    queueMoveTween(entityId, 0, 0, 1, 1);
    
    mockSprites[1].destroyed = true;
    tickAnimations(50, getMockSprite);

    expect(hasActiveAnimation(entityId)).toBe(false);
  });
});
