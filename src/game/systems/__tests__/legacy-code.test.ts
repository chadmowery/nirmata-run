import { describe, it, expect } from 'vitest';
import { getLegacyHeatCost, getLegacyMagnitude, applyLegacyToProfile } from '../legacy-code';
import { PlayerProfile } from '@shared/profile';
import { createEngineInstance } from '../../engine-factory';
import { AbilityDef, AugmentData, FirmwareSlots, AugmentSlots } from '@shared/components';

describe('Legacy Code System', () => {
  it('getLegacyHeatCost doubles cost if legacy', () => {
    expect(getLegacyHeatCost(25, false)).toBe(25);
    expect(getLegacyHeatCost(25, true)).toBe(50);
  });

  it('getLegacyMagnitude halves magnitude if legacy', () => {
    expect(getLegacyMagnitude(10, false)).toBe(10);
    expect(getLegacyMagnitude(10, true)).toBe(5);
    expect(getLegacyMagnitude(5, true)).toBe(2.5);
  });

  it('applyLegacyToProfile marks all installed items as legacy', () => {
    const mockProfile: PlayerProfile = {
      sessionId: 'test',
      wallet: { scrap: 0, flux: 0 },
      blueprintLibrary: [],
      installedItems: [
        { entityId: 1, blueprintId: 'b1', type: 'firmware', shellId: 's1', isLegacy: false },
        { entityId: 2, blueprintId: 'b2', type: 'augment', shellId: 's1', isLegacy: false },
      ],
      overflow: [],
      vault: [],
      shellUpgrades: {},
      attemptTracking: {
        dayNumber: 0,
        weekNumber: 0,
        dailyAttemptUsed: false,
        weeklyAttemptUsed: false,
      },
      weekSeed: 0,
      createdAt: Date.now(),
    };

    applyLegacyToProfile(mockProfile);

    expect(mockProfile.installedItems[0].isLegacy).toBe(true);
    expect(mockProfile.installedItems[1].isLegacy).toBe(true);
  });

  it('createEngineInstance propagates isLegacy flag to spawned entity components', () => {
    const profile: PlayerProfile = {
      sessionId: 'legacy-spawn-test',
      wallet: { scrap: 0, flux: 0 },
      blueprintLibrary: [],
      installedItems: [
        { entityId: 101, blueprintId: 'phase-shift', type: 'firmware', shellId: 'vanguard-v1', isLegacy: true },
        { entityId: 102, blueprintId: 'displacement-venting', type: 'augment', shellId: 'vanguard-v1', isLegacy: true },
      ],
      overflow: [],
      vault: [],
      shellUpgrades: {},
      attemptTracking: {
        dayNumber: 0,
        weekNumber: 0,
        dailyAttemptUsed: false,
        weeklyAttemptUsed: false,
      },
      weekSeed: 0,
      createdAt: Date.now(),
    };

    const instance = createEngineInstance({
      width: 20,
      height: 20,
      seed: 'test-seed',
      profile,
      shellRecord: {
        id: 'vanguard-v1',
        archetypeId: 'vanguard-v1',
        level: 1,
        currentStats: { speed: 100, stability: 100, armor: 1, maxHealth: 20 },
        portConfig: { maxFirmware: 2, maxAugment: 2, maxSoftware: 2 },
      },
    });

    const firmwareSlots = instance.world.getComponent(instance.playerId, FirmwareSlots);
    expect(firmwareSlots?.equipped.length).toBeGreaterThan(0);
    const fwId = firmwareSlots!.equipped[0];
    const abilityDef = instance.world.getComponent(fwId, AbilityDef);
    expect(abilityDef?.isLegacy).toBe(true);

    const augmentSlots = instance.world.getComponent(instance.playerId, AugmentSlots);
    expect(augmentSlots?.equipped.length).toBeGreaterThan(0);
    const augId = augmentSlots!.equipped[0];
    const augmentData = instance.world.getComponent(augId, AugmentData);
    expect(augmentData?.isLegacy).toBe(true);
  });
});
