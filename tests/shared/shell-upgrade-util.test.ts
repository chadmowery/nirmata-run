import { describe, it, expect } from 'vitest';
import {
  calculateShellStatBonuses,
  calculateEffectiveShellStats,
  calculateEffectivePortConfig,
  SHELL_UPGRADE_MULTIPLIERS,
} from '@shared/utils/shell-upgrade-util';

describe('shell-upgrade-util (U10)', () => {
  it('calculates stat bonuses from upgrade levels using canonical multipliers', () => {
    expect(calculateShellStatBonuses()).toEqual({
      speed: 0,
      armor: 0,
      stability: 0,
    });

    const bonuses = calculateShellStatBonuses({
      speed: 4,
      armor: 3,
      stability: 2,
    });

    expect(bonuses.speed).toBe(4 * SHELL_UPGRADE_MULTIPLIERS.speed); // 20
    expect(bonuses.armor).toBe(3 * SHELL_UPGRADE_MULTIPLIERS.armor); // 3
    expect(bonuses.stability).toBe(2 * SHELL_UPGRADE_MULTIPLIERS.stability); // 20
  });

  it('calculates effective stats additively without heuristic jumps for level > 5', () => {
    const baseStats = { speed: 80, armor: 0, stability: 50, maxHealth: 25 };

    // Test a high level (e.g. 6 or 10) to verify no > 5 heuristic exists
    const effective = calculateEffectiveShellStats(baseStats, {
      speed: 6,
      armor: 5,
      stability: 8,
    });

    expect(effective.speed).toBe(80 + 6 * 5); // 110
    expect(effective.armor).toBe(0 + 5 * 1); // 5
    expect(effective.stability).toBe(50 + 8 * 10); // 130
    expect(effective.maxHealth).toBe(25);
  });

  it('calculates effective port configuration symmetrically across firmware, augment, and software', () => {
    const basePorts = { maxFirmware: 2, maxAugment: 1, maxSoftware: 3 };

    const effective = calculateEffectivePortConfig(basePorts, {
      additionalPorts: 2,
    });

    expect(effective.maxFirmware).toBe(4);
    expect(effective.maxAugment).toBe(3);
    expect(effective.maxSoftware).toBe(5);
  });
});
