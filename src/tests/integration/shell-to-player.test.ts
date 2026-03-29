import { describe, it, expect } from 'vitest';
import { createEngineInstance } from '@game/engine-factory';
import { Health, Defense, Energy, Shell, PortConfig } from '@shared/components';

describe('Shell To Player Integration', () => {
  it('should apply shell stats to the spawned player entity', () => {
    const shellRecord = {
      id: 'test-inst',
      archetypeId: 'striker-v1',
      level: 1,
      currentStats: {
        speed: 150,
        stability: 5,
        armor: 2,
        maxHealth: 30,
      },
      portConfig: {
        maxFirmware: 3,
        maxAugment: 1,
        maxSoftware: 2,
      },
    };

    const instance = createEngineInstance({
      width: 20,
      height: 20,
      seed: 'test-seed',
      shellRecord: shellRecord as any, // Cast for simplicity in test
    });

    const { world, playerId } = instance;
    
    const health = world.getComponent(playerId, Health)!;
    expect(health.max).toBe(30);
    expect(health.current).toBe(30);

    const defense = world.getComponent(playerId, Defense)!;
    expect(defense.armor).toBe(2);

    const energy = world.getComponent(playerId, Energy)!;
    expect(energy.speed).toBe(150);

    const shell = world.getComponent(playerId, Shell)!;
    expect(shell.speed).toBe(150);

    const ports = world.getComponent(playerId, PortConfig)!;
    expect(ports.maxFirmware).toBe(3);
  });
});
