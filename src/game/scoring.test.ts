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
});
