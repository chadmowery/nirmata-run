import { describe, it, expect } from 'vitest';
import { validateConnectivity } from './flood-fill';

/**
 * Helper to create a walkability function from a 2D boolean array.
 * true = walkable, false = wall.
 */
function makeWalkable(grid: boolean[][]): (x: number, y: number) => boolean {
  return (x, y) => {
    if (y < 0 || y >= grid.length || x < 0 || x >= grid[0].length) return false;
    return grid[y][x];
  };
}

describe('validateConnectivity', () => {
  it('should report fully connected grid as connected', () => {
    // 5x5 all-floor grid
    const grid = Array.from({ length: 5 }, () => Array(5).fill(true));
    const result = validateConnectivity(5, 5, makeWalkable(grid), 0, 0);

    expect(result.connected).toBe(true);
    expect(result.reachable).toBe(25);
    expect(result.total).toBe(25);
    expect(result.unreachableRegions).toHaveLength(0);
  });

  it('should report disconnected grid as not connected', () => {
    // 5x5 grid with a wall barrier splitting it
    const grid = [
      [true,  true,  false, true,  true],
      [true,  true,  false, true,  true],
      [false, false, false, false, false],
      [true,  true,  false, true,  true],
      [true,  true,  false, true,  true],
    ];

    const result = validateConnectivity(5, 5, makeWalkable(grid), 0, 0);

    expect(result.connected).toBe(false);
    expect(result.reachable).toBe(4); // top-left 2x2
    expect(result.total).toBe(16); // 4 corners × 4 tiles each
    expect(result.unreachableRegions.length).toBeGreaterThan(0);
  });

  it('should handle single walkable tile', () => {
    const grid = [[true]];
    const result = validateConnectivity(1, 1, makeWalkable(grid), 0, 0);

    expect(result.connected).toBe(true);
    expect(result.reachable).toBe(1);
    expect(result.total).toBe(1);
  });

  it('should handle start position on wall', () => {
    const grid = [
      [false, true],
      [true,  true],
    ];
    const result = validateConnectivity(2, 2, makeWalkable(grid), 0, 0);

    expect(result.reachable).toBe(0);
    expect(result.connected).toBe(false);
    expect(result.total).toBe(3);
  });

  it('should detect isolated room as unreachable region', () => {
    // Main connected area + isolated 2x2 room in corner
    const grid = [
      [true,  true,  true,  false, false],
      [true,  true,  true,  false, false],
      [true,  true,  true,  false, false],
      [false, false, false, false, false],
      [false, false, false, true,  true],
    ];

    const result = validateConnectivity(5, 5, makeWalkable(grid), 0, 0);

    expect(result.connected).toBe(false);
    expect(result.reachable).toBe(9);
    expect(result.total).toBe(11);
    expect(result.unreachableRegions).toHaveLength(1);
  });

  it('should handle all-wall grid', () => {
    const grid = Array.from({ length: 3 }, () => Array(3).fill(false));
    const result = validateConnectivity(3, 3, makeWalkable(grid), 1, 1);

    expect(result.connected).toBe(true); // 0 reachable, 0 total → vacuously true
    expect(result.reachable).toBe(0);
    expect(result.total).toBe(0);
  });
});
