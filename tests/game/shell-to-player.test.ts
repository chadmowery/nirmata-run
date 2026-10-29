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

  it('should apply profile shellUpgrades to spawned player entity stats and ports', () => {
    const shellRecord = {
      id: 'vanguard-v1',
      archetypeId: 'vanguard-v1',
      level: 1,
      currentStats: {
        speed: 100,
        stability: 10,
        armor: 1,
        maxHealth: 25,
      },
      portConfig: {
        maxFirmware: 2,
        maxAugment: 1,
        maxSoftware: 2,
      },
    };

    const instance = createEngineInstance({
      width: 20,
      height: 20,
      seed: 'test-seed',
      shellRecord: shellRecord as any,
      profile: {
        sessionId: 'upgraded-player',
        wallet: { scrap: 0, flux: 0 },
        blueprintLibrary: [],
        installedItems: [],
        overflow: [],
        vault: [],
        shellUpgrades: {
          'vanguard-v1': {
            speed: 20,
            armor: 3,
            stability: 15,
            additionalPorts: 2,
          },
        },
        attemptTracking: { dayNumber: 0, weekNumber: 0, dailyAttemptUsed: false, weeklyAttemptUsed: false },
        weekSeed: 0,
        createdAt: Date.now(),
      },
    });

    const { world, playerId } = instance;

    const defense = world.getComponent(playerId, Defense)!;
    expect(defense.armor).toBe(4); // 1 base + 3 upgrade

    const energy = world.getComponent(playerId, Energy)!;
    expect(energy.speed).toBe(120); // 100 base + 20 upgrade

    const ports = world.getComponent(playerId, PortConfig)!;
    expect(ports.maxSoftware).toBe(4); // 2 base + 2 upgrade
  });
});
