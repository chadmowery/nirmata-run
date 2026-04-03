import { describe, it, expect } from 'vitest';
import { getLegacyHeatCost, getLegacyMagnitude, applyLegacyToProfile } from '../legacy-code';
import { PlayerProfile } from '@shared/profile';

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
        { blueprintId: 'b1', type: 'firmware', shellId: 's1', isLegacy: false },
        { blueprintId: 'b2', type: 'augment', shellId: 's1', isLegacy: false }
      ],
      overflow: [],
      vault: [],
      shellUpgrades: {},
      attemptTracking: { dayNumber: 0, weekNumber: 0, dailyAttemptUsed: false, weeklyAttemptUsed: false },
      weekSeed: 0,
      createdAt: Date.now()
    };

    applyLegacyToProfile(mockProfile);

    expect(mockProfile.installedItems[0].isLegacy).toBe(true);
    expect(mockProfile.installedItems[1].isLegacy).toBe(true);
  });
});
