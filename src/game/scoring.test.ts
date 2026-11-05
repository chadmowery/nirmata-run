import { describe, it, expect } from 'vitest';
import { calculateScore } from './scoring';

describe('calculateScore', () => {
  it('computes score using economy scoring weights', () => {
    const score = calculateScore({
      floorNumber: 3,
      scrapExtracted: 50,
      softwareExtracted: 2,
      fluxExtracted: 10,
    });

    expect(typeof score).toBe('number');
    expect(score).toBeGreaterThan(0);
  });

  it('returns 0 for zeroed stats', () => {
    const score = calculateScore({
      floorNumber: 0,
      scrapExtracted: 0,
      softwareExtracted: 0,
      fluxExtracted: 0,
    });

    expect(score).toBe(0);
  });

  it('includes environmental scoring bonuses for vaults breached and traps disarmed', () => {
    const baseScore = calculateScore({
      floorNumber: 5,
      scrapExtracted: 100,
      softwareExtracted: 1,
      fluxExtracted: 10,
    });

    const envScore = calculateScore({
      floorNumber: 5,
      scrapExtracted: 100,
      softwareExtracted: 1,
      fluxExtracted: 10,
      vaultsBreached: 2,
      trapsDisarmed: 3,
    });

    // 2 * 150 = 300, 3 * 50 = 150 -> total +450
    expect(envScore).toBe(baseScore + 450);
  });
});
