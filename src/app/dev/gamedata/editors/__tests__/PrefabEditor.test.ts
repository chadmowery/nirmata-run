import { describe, it, expect } from 'vitest';
import {
  ORIENTATION_CYCLE,
  ORIENTATION_ARROWS,
  ORIENTATION_DEGREES,
  CardinalOrientation,
} from '../PrefabEditor';
import { AutotileSolver } from '@/game/generation/autotile-solver';
import { Grid } from '@/engine/grid/grid';

describe('PrefabEditor Studio Enhancements (Milestone 5)', () => {
  describe('Brush Orientation & R-Key Cycling', () => {
    it('cycles orientation clockwise on each step', () => {
      let current: CardinalOrientation = 'NORTH';
      expect(current).toBe('NORTH');

      current = ORIENTATION_CYCLE[current];
      expect(current).toBe('EAST');

      current = ORIENTATION_CYCLE[current];
      expect(current).toBe('SOUTH');

      current = ORIENTATION_CYCLE[current];
      expect(current).toBe('WEST');

      current = ORIENTATION_CYCLE[current];
      expect(current).toBe('NORTH');
    });

    it('maps orientation to exact directional arrows and degree angles', () => {
      expect(ORIENTATION_ARROWS.NORTH).toBe('↑');
      expect(ORIENTATION_ARROWS.EAST).toBe('→');
      expect(ORIENTATION_ARROWS.SOUTH).toBe('↓');
      expect(ORIENTATION_ARROWS.WEST).toBe('←');

      expect(ORIENTATION_DEGREES.NORTH).toBe(0);
      expect(ORIENTATION_DEGREES.EAST).toBe(90);
      expect(ORIENTATION_DEGREES.SOUTH).toBe(180);
      expect(ORIENTATION_DEGREES.WEST).toBe(270);
    });
  });

  describe('Real-Time Autotile Preview Resolution', () => {
    it('solves wall caps and corners accurately from ASCII layout grid', () => {
      // 3x3 with wall cap extending into floor
      const grid = new Grid(3, 3);
      for (let y = 0; y < 3; y++) {
        for (let x = 0; x < 3; x++) {
          grid.setTile(x, y, { terrain: 'floor', walkable: true });
        }
      }
      // Wall at (1, 0) and (1, 1), with (1, 2) as floor
      // (1, 1) has neighbor only to North (1, 0)
      grid.setTile(1, 0, { terrain: 'wall', walkable: false });
      grid.setTile(1, 1, { terrain: 'wall', walkable: false });

      const capResult = AutotileSolver.resolveWallTile(grid, 1, 1);
      // North neighbor (bit 1) -> Pass 2 flips South-facing cap to face the open floor
      expect(capResult.frameKey).toBe('wall_cap_s');
      expect(capResult.angleDegrees).toBe(180);
    });

    it('solves directional door alignment from neighboring walls', () => {
      const grid = new Grid(3, 3);
      for (let y = 0; y < 3; y++) {
        for (let x = 0; x < 3; x++) {
          grid.setTile(x, y, { terrain: 'floor', walkable: true });
        }
      }
      // Walls North and South of center door
      grid.setTile(1, 0, { terrain: 'wall', walkable: false });
      grid.setTile(1, 1, { terrain: 'door', walkable: false });
      grid.setTile(1, 2, { terrain: 'wall', walkable: false });

      const doorResult = AutotileSolver.resolveDoorTile(grid, 1, 1);
      expect(doorResult.frameKey).toBe('door_v_closed');
      expect(doorResult.angleDegrees).toBe(0);
    });
  });
});
