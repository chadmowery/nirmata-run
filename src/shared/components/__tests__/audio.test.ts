import { describe, it, expect } from 'vitest';
import { AudioProfile, AmbientEmitter } from '../audio';

describe('Audio ECS Components', () => {
  it('validates AudioProfile default and custom values', () => {
    const defaultData = AudioProfile.schema.parse({});
    expect(defaultData.pitchMultiplier).toBe(1.0);
    expect(defaultData.volumeMultiplier).toBe(1.0);
    expect(defaultData.stepCue).toBeUndefined();

    const custom = AudioProfile.schema.parse({
      stepCue: 'sfx_step_player',
      attackCue: 'sfx_melee_hit',
      hitCue: 'sfx_player_damaged',
      deathCue: 'sfx_enemy_death',
      interactCue: 'sfx_prop_search',
      pitchMultiplier: 1.25,
      volumeMultiplier: 0.8,
    });

    expect(custom.stepCue).toBe('sfx_step_player');
    expect(custom.pitchMultiplier).toBe(1.25);
    expect(custom.volumeMultiplier).toBe(0.8);
  });

  it('rejects out-of-range multipliers in AudioProfile', () => {
    expect(() => AudioProfile.schema.parse({ pitchMultiplier: 0.1 })).toThrow();
    expect(() => AudioProfile.schema.parse({ pitchMultiplier: 5.0 })).toThrow();
    expect(() => AudioProfile.schema.parse({ volumeMultiplier: -0.1 })).toThrow();
    expect(() => AudioProfile.schema.parse({ volumeMultiplier: 2.5 })).toThrow();
  });

  it('validates AmbientEmitter schema defaults and options', () => {
    const data = AmbientEmitter.schema.parse({ cueId: 'amb_emitter_anchor' });
    expect(data.cueId).toBe('amb_emitter_anchor');
    expect(data.radius).toBe(8);
    expect(data.baseVolume).toBe(0.5);
    expect(data.falloff).toBe('linear');
    expect(data.requiresFov).toBe(false);
    expect(data.activeOnlyWhenUnsearched).toBe(false);

    const custom = AmbientEmitter.schema.parse({
      cueId: 'amb_emitter_vent',
      radius: 12,
      baseVolume: 0.8,
      falloff: 'inverse',
      requiresFov: true,
      activeOnlyWhenUnsearched: true,
    });

    expect(custom.radius).toBe(12);
    expect(custom.falloff).toBe('inverse');
    expect(custom.requiresFov).toBe(true);
    expect(custom.activeOnlyWhenUnsearched).toBe(true);
  });
});
