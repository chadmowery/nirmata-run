import { describe, it, expect, vi, beforeEach } from 'vitest';
import { queueDeathAnimation, tickAnimations, hasActiveAnimation, clearAnimations } from '../../src/rendering/animations';

describe('Death Animations', () => {
  const getMockSprite = (id: number) => {
    return mockSprites[id];
  };

  let mockSprites: Record<number, any> = {};

  beforeEach(() => {
    clearAnimations();
    mockSprites = {
      1: { alpha: 1.0, destroyed: false }
    };
  });

  it('should fade out alpha over 300ms and fire callback', () => {
    const onComplete = vi.fn();
    queueDeathAnimation(1, onComplete);

    expect(hasActiveAnimation(1)).toBe(true);

    // Halfway (150ms)
    tickAnimations(150, getMockSprite);
    expect(mockSprites[1].alpha).toBeCloseTo(0.5, 1);

    // Completion (another 150ms)
    tickAnimations(150, getMockSprite);
    expect(mockSprites[1].alpha).toBe(0);
    expect(onComplete).toHaveBeenCalled();
    expect(hasActiveAnimation(1)).toBe(false);
  });
});
