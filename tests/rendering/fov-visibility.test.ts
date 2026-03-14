import { describe, it, expect, beforeEach } from 'vitest';
import { computeFov, computeFovAlpha, createExploredSet, updateExplored, clearExplored } from '../../src/rendering/fov';

describe('FOV Computation & Explored Set Management', () => {
  const radius = 8;

  describe('computeFov', () => {
    it('should make all tiles visible in an open 5x5 room with player at center', () => {
      // 5x5 room: (0,0) to (4,4), player at (2,2)
      const lightPasses = (x: number, y: number) => x >= 0 && x <= 4 && y >= 0 && y <= 4;
      const exploredSet = new Set<string>();
      
      const visibleSet = computeFov(2, 2, radius, lightPasses, exploredSet);

      // 5x5 room (all floors) + 1-tile boundary wall = 7x7 = 49 tiles expected
      expect(visibleSet.size).toBe(49);
      for (let y = 0; y < 5; y++) {
        for (let x = 0; x < 5; x++) {
          expect(visibleSet.has(`${x},${y}`)).toBe(true);
        }
      }
      expect(visibleSet.has('-1,-1')).toBe(true); // Boundary wall
      expect(visibleSet.has('5,5')).toBe(true);   // Boundary wall
      
      // Explored set should match visible set
      expect(exploredSet.size).toBe(49);
    });

    it('should exclude tiles behind a wall', () => {
      // 10x10 area, player at (2,2), wall at (4,2)
      const lightPasses = (x: number, y: number) => {
        if (x === 4 && y === 2) return false;
        return true;
      };
      const exploredSet = new Set<string>();
      
      const visibleSet = computeFov(2, 2, radius, lightPasses, exploredSet);

      // (5,2) and (6,2) should be blocked by wall at (4,2)
      expect(visibleSet.has('4,2')).toBe(true); // Wall itself is visible
      expect(visibleSet.has('5,2')).toBe(false);
      expect(visibleSet.has('6,2')).toBe(false);
    });

    it('should include walls at the FOV boundary', () => {
      // Player at (0,0), radius 2. Wall at (2,0).
      // (2,0) is at distance 2, should be visible.
      const lightPasses = (x: number, y: number) => {
        if (x === 2 && y === 0) return false;
        return true;
      };
      const exploredSet = new Set<string>();
      
      const visibleSet = computeFov(0, 0, 2, lightPasses, exploredSet);

      expect(visibleSet.has('2,0')).toBe(true);
    });
  });

  describe('computeFovAlpha', () => {
    it('should return 1.0 for player position', () => {
      const alpha = computeFovAlpha(2, 2, 2, 2, radius);
      expect(alpha).toBe(1.0);
    });

    it('should return approx 0.5 for tiles at FOV edge', () => {
      // Tile at (10, 2) is distance 8 from (2, 2)
      const alpha = computeFovAlpha(10, 2, 2, 2, 8);
      expect(alpha).toBeCloseTo(0.5);
    });

    it('should decrease monotonically with distance', () => {
      const alphaNear = computeFovAlpha(3, 2, 2, 2, radius);
      const alphaFar = computeFovAlpha(5, 2, 2, 2, radius);
      expect(alphaNear).toBeGreaterThan(alphaFar);
      expect(alphaFar).toBeGreaterThanOrEqual(0.5);
    });
  });

  describe('Explored Set Management', () => {
    it('should accumulate tiles across moves', () => {
      const lightPasses = () => true;
      const exploredSet = createExploredSet();
      
      // Move 1
      computeFov(0, 0, 2, lightPasses, exploredSet);
      const size1 = exploredSet.size;
      expect(size1).toBeGreaterThan(0);

      // Move 2
      computeFov(10, 10, 2, lightPasses, exploredSet);
      expect(exploredSet.size).toBeGreaterThan(size1);
      
      // Ensure move 1 tiles are still there
      expect(exploredSet.has('0,0')).toBe(true);
      expect(exploredSet.has('10,10')).toBe(true);
    });

    it('should clear explored set', () => {
      const exploredSet = new Set(['1,1', '2,2']);
      clearExplored(exploredSet);
      expect(exploredSet.size).toBe(0);
    });

    it('should update explored set from fov set', () => {
      const exploredSet = new Set(['1,1']);
      const fovSet = new Set(['2,2', '3,3']);
      updateExplored(exploredSet, fovSet);
      expect(exploredSet.has('1,1')).toBe(true);
      expect(exploredSet.has('2,2')).toBe(true);
      expect(exploredSet.has('3,3')).toBe(true);
    });
  });
});
