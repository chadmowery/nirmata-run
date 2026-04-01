import { vi, describe, it, expect, beforeEach } from 'vitest';
import { applyDamageDistortion, removePersistentGlitch } from './glitch-effects';

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

    vi.advanceTimersByTime(101); 
    // Total 201ms elapsed. If it hadn't been refreshed, it would be gone.
    // But it was refreshed to 200ms starting from T=100ms, so it should still be there.
    expect(sprite.filters).toHaveLength(1);

    vi.advanceTimersByTime(100);
    // Total 301ms elapsed. Now it should be gone.
    expect(sprite.filters).toBeNull();
  });
  
  it('should preserve persistent filters when damage glitch is removed', () => {
    const persistentFilter = { name: 'persistent' };
    sprite.filters = [persistentFilter as any];
    
    applyDamageDistortion(sprite, 200);
    expect(sprite.filters).toHaveLength(2);
    expect(sprite.filters).toContain(persistentFilter);
    
    vi.advanceTimersByTime(201);
    expect(sprite.filters).toHaveLength(1);
    expect(sprite.filters[0]).toBe(persistentFilter);
  });

  it('should handle removal of all filters even with active damage tracking', () => {
    applyDamageDistortion(sprite, 200);
    expect(sprite.filters).toHaveLength(1);
    
    removePersistentGlitch(sprite);
    expect(sprite.filters).toBeNull();
    
    // Even if the damage timer fires later, it shouldn't crash or re-add/re-remove wrongly
    vi.advanceTimersByTime(201);
    expect(sprite.filters).toBeNull();
  });
});
