import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { queueAttackAnimationWithDefender, tickAnimations, hasActiveAnimation, clearAnimations } from '../../src/rendering/animations';

describe('Attack Animations', () => {
  const getMockSprite = (id: number) => {
    return mockSprites[id];
  };

  let mockSprites: Record<number, any> = {};

  beforeEach(() => {
    vi.useFakeTimers();
    clearAnimations();
    mockSprites = {
      1: { x: 0, y: 0, tint: 0xFFFFFF, destroyed: false }, // Attacker
      2: { x: 32, y: 0, tint: 0xFFFFFF, destroyed: false } // Defender
    };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should play lunge (75ms) and return (75ms) animations', () => {
    // Attacker at (0,0), Defender at (1,0)
    queueAttackAnimationWithDefender(1, { x: 0, y: 0 }, 2, { x: 1, y: 0 }, getMockSprite);

    expect(hasActiveAnimation(1)).toBe(true);
    expect(mockSprites[2].tint).toBe(0xFF0000);

    // Start of lunge
    tickAnimations(0, getMockSprite);
    expect(mockSprites[1].x).toBe(0);

    // Halfway through lunge (37.5ms) -> 30% * 0.5 = 15% toward target (32 * 0.15 = 4.8)
    tickAnimations(37.5, getMockSprite);
    expect(mockSprites[1].x).toBeCloseTo(4.8, 1);

    // End of lunge (another 37.5ms) -> 30% toward target (32 * 0.3 = 9.6)
    tickAnimations(37.5, getMockSprite);
    expect(mockSprites[1].x).toBeCloseTo(9.6, 1);

    // Start of return (lunge is complete, return is queued)
    tickAnimations(0, getMockSprite);
    expect(mockSprites[1].x).toBeCloseTo(9.6, 1);

    // Halfway through return (37.5ms) -> back to 15% (4.8)
    tickAnimations(37.5, getMockSprite);
    expect(mockSprites[1].x).toBeCloseTo(4.8, 1);

    // End of return (another 37.5ms) -> 0
    tickAnimations(37.5, getMockSprite);
    expect(mockSprites[1].x).toBe(0);

    expect(hasActiveAnimation(1)).toBe(false);
  });

  it('should reset defender tint after 150ms', () => {
    queueAttackAnimationWithDefender(1, { x: 0, y: 0 }, 2, { x: 1, y: 0 }, getMockSprite);
    
    expect(mockSprites[2].tint).toBe(0xFF0000);

    vi.advanceTimersByTime(150);
    expect(mockSprites[2].tint).toBe(0xFFFFFF);
  });
});
