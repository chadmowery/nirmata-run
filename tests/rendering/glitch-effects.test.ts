import { vi, describe, it, expect, beforeEach } from 'vitest';
import { applyDamageDistortion, removePersistentGlitch } from '../../src/rendering/filters/glitch-effects';

// Mock PIXI and pixi-filters
vi.mock('pixi.js', () => ({
  Sprite: class {
    filters: any[] | null = null;
    destroyed = false;
  },
  Filter: class {},
}));

vi.mock('pixi-filters', () => ({
  GlitchFilter: class {
    constructor(public options: any) {}
  },
  RGBSplitFilter: class {
    constructor(public options: any) {}
  },
}));

describe('glitch-effects', () => {
  let sprite: any;

  beforeEach(() => {
    vi.useFakeTimers();
    // Clear the internal WeakMap state by creating a new sprite reference
    // Since WeakMap uses object references as keys, a new sprite is a fresh start.
    const { Sprite } = require('pixi.js');
    sprite = new Sprite();
  });

  it('should apply and then remove damage glitch', () => {
    applyDamageDistortion(sprite, 200);
    expect(sprite.filters).toHaveLength(1);

    vi.advanceTimersByTime(201); // Advance slightly past 200ms
    expect(sprite.filters).toBeNull();
  });

  it('should not leak filters if damage is overlapping', () => {
    applyDamageDistortion(sprite, 200);
    expect(sprite.filters).toHaveLength(1);
    const firstFilter = sprite.filters[0];

    vi.advanceTimersByTime(100);
    applyDamageDistortion(sprite, 200);

    // In our new logic, if a damage glitch is active, we JUST refresh the timer.
    // So there should still be exactly 1 filter, and it should be the same instance.
    expect(sprite.filters).toHaveLength(1);
    expect(sprite.filters[0]).toBe(firstFilter);

    // Advance 100ms (original would have expired here, but it was extended)
    vi.advanceTimersByTime(100);
    expect(sprite.filters).toHaveLength(1);

    // Advance the remaining 101ms (total 201ms from 2nd trigger)
    vi.advanceTimersByTime(101);
    expect(sprite.filters).toBeNull();
  });

  it('should apply and remove persistent heat glitch without destroying damage glitch', () => {
    // 1. Heat glitch
    removePersistentGlitch(sprite);
    expect(sprite.filters).toBeNull();

    // 2. Damage glitch on top
    applyDamageDistortion(sprite, 200);
    expect(sprite.filters).toHaveLength(1);

    // 3. Clear damage glitch via timeout
    vi.advanceTimersByTime(201);
    expect(sprite.filters).toBeNull();
  });

  it('should not crash if sprite is destroyed before timer fires', () => {
    applyDamageDistortion(sprite, 200);
    sprite.destroyed = true;

    expect(() => {
      vi.advanceTimersByTime(201);
    }).not.toThrow();
  });
});
