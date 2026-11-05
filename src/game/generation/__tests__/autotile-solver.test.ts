import { describe, it, expect } from 'vitest';
import { Grid } from '@engine/grid/grid';
import { AutotileSolver, CARDINAL_AUTOTILE_TABLE } from '../autotile-solver';

describe('AutotileSolver (Milestone 2)', () => {
  it('verifies all 16 cardinal bitmasks in CARDINAL_AUTOTILE_TABLE match the specification', () => {
    // 0: Isolated Pillar
    expect(CARDINAL_AUTOTILE_TABLE[0]).toEqual({
      tileClass: 'pillar',
      frameKey: 'wall_pillar',
      orientation: 'NORTH',
    });

    // 1: Wall Cap (South Terminal)
    expect(CARDINAL_AUTOTILE_TABLE[1]).toEqual({
      tileClass: 'cap',
      frameKey: 'wall_cap_s',
      orientation: 'SOUTH',
    });

    // 2: Wall Cap (West Terminal)
    expect(CARDINAL_AUTOTILE_TABLE[2]).toEqual({
      tileClass: 'cap',
      frameKey: 'wall_cap_w',
      orientation: 'WEST',
    });

    // 3: Outer Corner (South-West)
    expect(CARDINAL_AUTOTILE_TABLE[3]).toEqual({
      tileClass: 'corner_outer',
      frameKey: 'wall_corner_outer_sw',
      orientation: 'SOUTH',
    });

    // 4: Wall Cap (North Terminal)
    expect(CARDINAL_AUTOTILE_TABLE[4]).toEqual({
      tileClass: 'cap',
      frameKey: 'wall_cap_n',
      orientation: 'NORTH',
    });

    // 5: Vertical Straight Run
    expect(CARDINAL_AUTOTILE_TABLE[5]).toEqual({
      tileClass: 'straight',
      frameKey: 'wall_straight_v',
      orientation: 'NORTH',
    });

    // 6: Outer Corner (North-West)
    expect(CARDINAL_AUTOTILE_TABLE[6]).toEqual({
      tileClass: 'corner_outer',
      frameKey: 'wall_corner_outer_nw',
      orientation: 'WEST',
    });

    // 7: T-Junction (West Facing)
    expect(CARDINAL_AUTOTILE_TABLE[7]).toEqual({
      tileClass: 'tjunction',
      frameKey: 'wall_tjunction_w',
      orientation: 'WEST',
    });

    // 8: Wall Cap (East Terminal)
    expect(CARDINAL_AUTOTILE_TABLE[8]).toEqual({
      tileClass: 'cap',
      frameKey: 'wall_cap_e',
      orientation: 'EAST',
    });

    // 9: Outer Corner (South-East)
    expect(CARDINAL_AUTOTILE_TABLE[9]).toEqual({
      tileClass: 'corner_outer',
      frameKey: 'wall_corner_outer_se',
      orientation: 'EAST',
    });

    // 10: Horizontal Straight Run
    expect(CARDINAL_AUTOTILE_TABLE[10]).toEqual({
      tileClass: 'straight',
      frameKey: 'wall_straight_h',
      orientation: 'EAST',
    });

    // 11: T-Junction (South Facing)
    expect(CARDINAL_AUTOTILE_TABLE[11]).toEqual({
      tileClass: 'tjunction',
      frameKey: 'wall_tjunction_s',
      orientation: 'SOUTH',
    });

    // 12: Outer Corner (North-East)
    expect(CARDINAL_AUTOTILE_TABLE[12]).toEqual({
      tileClass: 'corner_outer',
      frameKey: 'wall_corner_outer_ne',
      orientation: 'NORTH',
    });

    // 13: T-Junction (East Facing)
    expect(CARDINAL_AUTOTILE_TABLE[13]).toEqual({
      tileClass: 'tjunction',
      frameKey: 'wall_tjunction_e',
      orientation: 'EAST',
    });

    // 14: T-Junction (North Facing)
    expect(CARDINAL_AUTOTILE_TABLE[14]).toEqual({
      tileClass: 'tjunction',
      frameKey: 'wall_tjunction_n',
      orientation: 'NORTH',
    });

    // 15: Cross-Junction
    expect(CARDINAL_AUTOTILE_TABLE[15]).toEqual({
      tileClass: 'cross',
      frameKey: 'wall_cross',
      orientation: 'NORTH',
    });
  });

  it('correctly calculates bitmasks and resolves tiles for all 16 orthogonal neighbor combinations on a 5x5 grid', () => {
    // Create a helper grid where center is at (2, 2)
    for (let mask = 0; mask <= 15; mask++) {
      const grid = new Grid(5, 5);
      // Initialize all tiles as floor
      for (let y = 0; y < 5; y++) {
        for (let x = 0; x < 5; x++) {
          grid.setTile(x, y, { terrain: 'floor', walkable: true, transparent: true });
        }
      }

      // Center is a wall
      grid.setTile(2, 2, { terrain: 'wall', walkable: false, transparent: false });

      // Apply neighbors based on bits:
      // Bit 0 (N: +1): (2, 1)
      if (mask & 1) grid.setTile(2, 1, { terrain: 'wall', walkable: false, transparent: false });
      // Bit 1 (E: +2): (3, 2)
      if (mask & 2) grid.setTile(3, 2, { terrain: 'wall', walkable: false, transparent: false });
      // Bit 2 (S: +4): (2, 3)
      if (mask & 4) grid.setTile(2, 3, { terrain: 'wall', walkable: false, transparent: false });
      // Bit 3 (W: +8): (1, 2)
      if (mask & 8) grid.setTile(1, 2, { terrain: 'wall', walkable: false, transparent: false });

      const computedMask = AutotileSolver.computeCardinalBitmask(grid, 2, 2, false);
      expect(computedMask).toBe(mask);

      const result = AutotileSolver.resolveWallTile(grid, 2, 2, false);
      expect(result.bitmask).toBe(mask);

      // If mask is 15 and all diagonals are floor, it resolves an inner corner (e.g. NW)
      if (mask === 15) {
        expect(result.tileClass).toBe('corner_inner');
        expect(result.frameKey).toBe('wall_corner_inner_nw');
      } else {
        expect(result.tileClass).toBe(CARDINAL_AUTOTILE_TABLE[mask].tileClass);
        expect(result.frameKey).toBe(CARDINAL_AUTOTILE_TABLE[mask].frameKey);
        expect(result.orientation).toBe(CARDINAL_AUTOTILE_TABLE[mask].orientation);
      }
    }
  });

  describe('Pass 2: Wall Cap Inversion Logic', () => {
    it('inverts South wall cap when neighbor is strictly North (bitmask 1)', () => {
      const grid = new Grid(3, 3);
      for (let y = 0; y < 3; y++) {
        for (let x = 0; x < 3; x++) {
          grid.setTile(x, y, { terrain: 'floor', walkable: true, transparent: true });
        }
      }
      grid.setTile(1, 1, { terrain: 'wall', walkable: false, transparent: false });
      grid.setTile(1, 0, { terrain: 'wall', walkable: false, transparent: false }); // North neighbor

      const res = AutotileSolver.resolveWallTile(grid, 1, 1, false);
      expect(res.bitmask).toBe(1);
      expect(res.tileClass).toBe('cap');
      expect(res.frameKey).toBe('wall_cap_s');
      expect(res.orientation).toBe('SOUTH');
      expect(res.angleDegrees).toBe(180);
    });

    it('inverts West wall cap when neighbor is strictly East (bitmask 2)', () => {
      const grid = new Grid(3, 3);
      for (let y = 0; y < 3; y++) {
        for (let x = 0; x < 3; x++) {
          grid.setTile(x, y, { terrain: 'floor', walkable: true, transparent: true });
        }
      }
      grid.setTile(1, 1, { terrain: 'wall', walkable: false, transparent: false });
      grid.setTile(2, 1, { terrain: 'wall', walkable: false, transparent: false }); // East neighbor

      const res = AutotileSolver.resolveWallTile(grid, 1, 1, false);
      expect(res.bitmask).toBe(2);
      expect(res.tileClass).toBe('cap');
      expect(res.frameKey).toBe('wall_cap_w');
      expect(res.orientation).toBe('WEST');
      expect(res.angleDegrees).toBe(270);
    });

    it('inverts North wall cap when neighbor is strictly South (bitmask 4)', () => {
      const grid = new Grid(3, 3);
      for (let y = 0; y < 3; y++) {
        for (let x = 0; x < 3; x++) {
          grid.setTile(x, y, { terrain: 'floor', walkable: true, transparent: true });
        }
      }
      grid.setTile(1, 1, { terrain: 'wall', walkable: false, transparent: false });
      grid.setTile(1, 2, { terrain: 'wall', walkable: false, transparent: false }); // South neighbor

      const res = AutotileSolver.resolveWallTile(grid, 1, 1, false);
      expect(res.bitmask).toBe(4);
      expect(res.tileClass).toBe('cap');
      expect(res.frameKey).toBe('wall_cap_n');
      expect(res.orientation).toBe('NORTH');
      expect(res.angleDegrees).toBe(0);
    });

    it('inverts East wall cap when neighbor is strictly West (bitmask 8)', () => {
      const grid = new Grid(3, 3);
      for (let y = 0; y < 3; y++) {
        for (let x = 0; x < 3; x++) {
          grid.setTile(x, y, { terrain: 'floor', walkable: true, transparent: true });
        }
      }
      grid.setTile(1, 1, { terrain: 'wall', walkable: false, transparent: false });
      grid.setTile(0, 1, { terrain: 'wall', walkable: false, transparent: false }); // West neighbor

      const res = AutotileSolver.resolveWallTile(grid, 1, 1, false);
      expect(res.bitmask).toBe(8);
      expect(res.tileClass).toBe('cap');
      expect(res.frameKey).toBe('wall_cap_e');
      expect(res.orientation).toBe('EAST');
      expect(res.angleDegrees).toBe(90);
    });
  });

  describe('Pass 3: 8-Bit Diagonal Corner Refinement', () => {
    function createSolid3x3Grid(): Grid {
      const grid = new Grid(3, 3);
      for (let y = 0; y < 3; y++) {
        for (let x = 0; x < 3; x++) {
          grid.setTile(x, y, { terrain: 'wall', walkable: false, transparent: false });
        }
      }
      return grid;
    }

    it('resolves wall_cross when all 8 neighbors are walls', () => {
      const grid = createSolid3x3Grid();
      const res = AutotileSolver.resolveWallTile(grid, 1, 1, false);
      expect(res.bitmask).toBe(15);
      expect(res.tileClass).toBe('cross');
      expect(res.frameKey).toBe('wall_cross');
    });

    it('resolves wall_corner_inner_nw when NW diagonal is walkable floor', () => {
      const grid = createSolid3x3Grid();
      grid.setTile(0, 0, { terrain: 'floor', walkable: true, transparent: true });

      const res = AutotileSolver.resolveWallTile(grid, 1, 1, false);
      expect(res.bitmask).toBe(15);
      expect(res.tileClass).toBe('corner_inner');
      expect(res.frameKey).toBe('wall_corner_inner_nw');
      expect(res.orientation).toBe('NORTH');
    });

    it('resolves wall_corner_inner_ne when NE diagonal is walkable floor', () => {
      const grid = createSolid3x3Grid();
      grid.setTile(2, 0, { terrain: 'floor', walkable: true, transparent: true });

      const res = AutotileSolver.resolveWallTile(grid, 1, 1, false);
      expect(res.bitmask).toBe(15);
      expect(res.tileClass).toBe('corner_inner');
      expect(res.frameKey).toBe('wall_corner_inner_ne');
      expect(res.orientation).toBe('EAST');
    });

    it('resolves wall_corner_inner_se when SE diagonal is walkable floor', () => {
      const grid = createSolid3x3Grid();
      grid.setTile(2, 2, { terrain: 'floor', walkable: true, transparent: true });

      const res = AutotileSolver.resolveWallTile(grid, 1, 1, false);
      expect(res.bitmask).toBe(15);
      expect(res.tileClass).toBe('corner_inner');
      expect(res.frameKey).toBe('wall_corner_inner_se');
      expect(res.orientation).toBe('SOUTH');
    });

    it('resolves wall_corner_inner_sw when SW diagonal is walkable floor', () => {
      const grid = createSolid3x3Grid();
      grid.setTile(0, 2, { terrain: 'floor', walkable: true, transparent: true });

      const res = AutotileSolver.resolveWallTile(grid, 1, 1, false);
      expect(res.bitmask).toBe(15);
      expect(res.tileClass).toBe('corner_inner');
      expect(res.frameKey).toBe('wall_corner_inner_sw');
      expect(res.orientation).toBe('WEST');
    });
  });

  describe('Door orientation resolution', () => {
    it('resolves vertical doorway when walls are North and South', () => {
      const grid = new Grid(3, 3);
      for (let y = 0; y < 3; y++) {
        for (let x = 0; x < 3; x++) {
          grid.setTile(x, y, { terrain: 'floor', walkable: true, transparent: true });
        }
      }
      grid.setTile(1, 1, { terrain: 'door', walkable: true, transparent: true });
      grid.setTile(1, 0, { terrain: 'wall', walkable: false, transparent: false }); // North wall
      grid.setTile(1, 2, { terrain: 'wall', walkable: false, transparent: false }); // South wall

      const res = AutotileSolver.resolveDoorTile(grid, 1, 1);
      expect(res.isVertical).toBe(true);
      expect(res.frameKey).toBe('door_v_closed');
    });

    it('resolves horizontal doorway when walls are East and West', () => {
      const grid = new Grid(3, 3);
      for (let y = 0; y < 3; y++) {
        for (let x = 0; x < 3; x++) {
          grid.setTile(x, y, { terrain: 'floor', walkable: true, transparent: true });
        }
      }
      grid.setTile(1, 1, { terrain: 'door', walkable: true, transparent: true });
      grid.setTile(0, 1, { terrain: 'wall', walkable: false, transparent: false }); // West wall
      grid.setTile(2, 1, { terrain: 'wall', walkable: false, transparent: false }); // East wall

      const res = AutotileSolver.resolveDoorTile(grid, 1, 1);
      expect(res.isVertical).toBe(false);
      expect(res.frameKey).toBe('door_h_closed');
    });
  });

  describe('solveAllWalls', () => {
    it('pre-computes autotile results for all wall tiles across grid', () => {
      const grid = new Grid(4, 4);
      for (let y = 0; y < 4; y++) {
        for (let x = 0; x < 4; x++) {
          grid.setTile(x, y, { terrain: 'wall', walkable: false, transparent: false });
        }
      }
      // Carve 2x2 room in center
      grid.setTile(1, 1, { terrain: 'floor', walkable: true, transparent: true });
      grid.setTile(1, 2, { terrain: 'floor', walkable: true, transparent: true });
      grid.setTile(2, 1, { terrain: 'floor', walkable: true, transparent: true });
      grid.setTile(2, 2, { terrain: 'floor', walkable: true, transparent: true });

      const allWalls = AutotileSolver.solveAllWalls(grid);
      // 16 total tiles - 4 floors = 12 walls
      expect(allWalls.size).toBe(12);
      expect(allWalls.has('0,0')).toBe(true);
      expect(allWalls.has('1,1')).toBe(false);
    });
  });
});
