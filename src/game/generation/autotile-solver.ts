import { Grid } from '@engine/grid/grid';
import {
  Orientation,
  AutotileClass,
  ORIENTATION_ANGLES,
} from '@shared/components/environment';

export interface AutotileResult {
  bitmask: number;
  tileClass: AutotileClass;
  frameKey: string;
  orientation: Orientation;
  angleDegrees: number;
}

export interface DoorAutotileResult {
  frameKey: string;
  orientation: Orientation;
  angleDegrees: number;
  isVertical: boolean;
}

/**
 * Canonical 4-bit cardinal bitmask lookup table (DIRECTIONAL-TILEMAPS.md §3.2).
 * Bitmask = (N * 1) + (E * 2) + (S * 4) + (W * 8)
 */
export const CARDINAL_AUTOTILE_TABLE: Record<
  number,
  {
    tileClass: AutotileClass;
    frameKey: string;
    orientation: Orientation;
  }
> = {
  0: { tileClass: 'pillar', frameKey: 'wall_pillar', orientation: 'NORTH' },
  1: { tileClass: 'cap', frameKey: 'wall_cap_s', orientation: 'SOUTH' }, // Wall ends pointing South
  2: { tileClass: 'cap', frameKey: 'wall_cap_w', orientation: 'WEST' },  // Wall ends pointing West
  3: { tileClass: 'corner_outer', frameKey: 'wall_corner_outer_sw', orientation: 'SOUTH' },
  4: { tileClass: 'cap', frameKey: 'wall_cap_n', orientation: 'NORTH' }, // Wall ends pointing North
  5: { tileClass: 'straight', frameKey: 'wall_straight_v', orientation: 'NORTH' },
  6: { tileClass: 'corner_outer', frameKey: 'wall_corner_outer_nw', orientation: 'WEST' },
  7: { tileClass: 'tjunction', frameKey: 'wall_tjunction_w', orientation: 'WEST' },
  8: { tileClass: 'cap', frameKey: 'wall_cap_e', orientation: 'EAST' },  // Wall ends pointing East
  9: { tileClass: 'corner_outer', frameKey: 'wall_corner_outer_se', orientation: 'EAST' },
  10: { tileClass: 'straight', frameKey: 'wall_straight_h', orientation: 'EAST' },
  11: { tileClass: 'tjunction', frameKey: 'wall_tjunction_s', orientation: 'SOUTH' },
  12: { tileClass: 'corner_outer', frameKey: 'wall_corner_outer_ne', orientation: 'NORTH' },
  13: { tileClass: 'tjunction', frameKey: 'wall_tjunction_e', orientation: 'EAST' },
  14: { tileClass: 'tjunction', frameKey: 'wall_tjunction_n', orientation: 'NORTH' },
  15: { tileClass: 'cross', frameKey: 'wall_cross', orientation: 'NORTH' },
};

export class AutotileSolver {
  /**
   * Returns true if the tile at (x, y) is solid terrain (wall or door) for autotile adjacency.
   * Out-of-bounds tiles are treated as solid walls by default to prevent exterior walls
   * from terminating into open-space caps.
   */
  public static isSolid(
    grid: Grid,
    x: number,
    y: number,
    outOfBoundsIsSolid: boolean = true,
  ): boolean {
    if (!grid.inBounds(x, y)) {
      return outOfBoundsIsSolid;
    }
    const tile = grid.getTile(x, y);
    if (!tile) return outOfBoundsIsSolid;
    return tile.terrain === 'wall' || tile.terrain === 'door';
  }

  /**
   * Returns true if the tile at (x, y) is walkable open space / floor.
   */
  public static isWalkableFloor(grid: Grid, x: number, y: number): boolean {
    if (!grid.inBounds(x, y)) return false;
    const tile = grid.getTile(x, y);
    if (!tile) return false;
    return tile.terrain === 'floor' && tile.walkable;
  }

  /**
   * Computes the 4-bit cardinal bitmask for the tile at (x, y).
   * Bitmask = (N * 1) + (E * 2) + (S * 4) + (W * 8)
   */
  public static computeCardinalBitmask(
    grid: Grid,
    x: number,
    y: number,
    outOfBoundsIsSolid: boolean = true,
  ): number {
    const n = AutotileSolver.isSolid(grid, x, y - 1, outOfBoundsIsSolid) ? 1 : 0;
    const e = AutotileSolver.isSolid(grid, x + 1, y, outOfBoundsIsSolid) ? 2 : 0;
    const s = AutotileSolver.isSolid(grid, x, y + 1, outOfBoundsIsSolid) ? 4 : 0;
    const w = AutotileSolver.isSolid(grid, x - 1, y, outOfBoundsIsSolid) ? 8 : 0;
    return n + e + s + w;
  }

  /**
   * Resolves the autotiled frame, classification, and orientation for a wall tile.
   * Implements 4-bit cardinal solving, wall cap inversion, and 8-bit diagonal corner refinement.
   */
  public static resolveWallTile(
    grid: Grid,
    x: number,
    y: number,
    outOfBoundsIsSolid: boolean = true,
  ): AutotileResult {
    const bitmask = AutotileSolver.computeCardinalBitmask(grid, x, y, outOfBoundsIsSolid);
    const baseDef = CARDINAL_AUTOTILE_TABLE[bitmask] ?? CARDINAL_AUTOTILE_TABLE[0];

    // Pass 3: 8-Bit Corner Refinement for full cross-junctions (bitmask === 15)
    if (bitmask === 15) {
      const nwFloor = AutotileSolver.isWalkableFloor(grid, x - 1, y - 1);
      const neFloor = AutotileSolver.isWalkableFloor(grid, x + 1, y - 1);
      const seFloor = AutotileSolver.isWalkableFloor(grid, x + 1, y + 1);
      const swFloor = AutotileSolver.isWalkableFloor(grid, x - 1, y + 1);

      const floorCount =
        (nwFloor ? 1 : 0) + (neFloor ? 1 : 0) + (seFloor ? 1 : 0) + (swFloor ? 1 : 0);

      // If exactly one diagonal neighbor is walkable floor, resolve the corresponding inner corner.
      // If multiple diagonals or none are floor, fallback to wall_cross.
      if (floorCount === 1) {
        if (nwFloor) {
          return {
            bitmask,
            tileClass: 'corner_inner',
            frameKey: 'wall_corner_inner_nw',
            orientation: 'NORTH',
            angleDegrees: ORIENTATION_ANGLES.NORTH,
          };
        }
        if (neFloor) {
          return {
            bitmask,
            tileClass: 'corner_inner',
            frameKey: 'wall_corner_inner_ne',
            orientation: 'EAST',
            angleDegrees: ORIENTATION_ANGLES.EAST,
          };
        }
        if (seFloor) {
          return {
            bitmask,
            tileClass: 'corner_inner',
            frameKey: 'wall_corner_inner_se',
            orientation: 'SOUTH',
            angleDegrees: ORIENTATION_ANGLES.SOUTH,
          };
        }
        if (swFloor) {
          return {
            bitmask,
            tileClass: 'corner_inner',
            frameKey: 'wall_corner_inner_sw',
            orientation: 'WEST',
            angleDegrees: ORIENTATION_ANGLES.WEST,
          };
        }
      }
    }

    return {
      bitmask,
      tileClass: baseDef.tileClass,
      frameKey: baseDef.frameKey,
      orientation: baseDef.orientation,
      angleDegrees: ORIENTATION_ANGLES[baseDef.orientation],
    };
  }

  /**
   * Resolves orientation and frame for a door tile based on adjoining walls.
   */
  public static resolveDoorTile(grid: Grid, x: number, y: number): DoorAutotileResult {
    const northWall = grid.getTile(x, y - 1)?.terrain === 'wall';
    const southWall = grid.getTile(x, y + 1)?.terrain === 'wall';
    const eastWall = grid.getTile(x + 1, y)?.terrain === 'wall';
    const westWall = grid.getTile(x - 1, y)?.terrain === 'wall';

    // If walls are North & South, the doorway spans vertically (corridor runs East-West)
    if (northWall && southWall && !eastWall && !westWall) {
      return {
        frameKey: 'door_v_closed',
        orientation: 'NORTH',
        angleDegrees: 0,
        isVertical: true,
      };
    }

    // Default: horizontal doorway spanning East-West (corridor runs North-South)
    return {
      frameKey: 'door_h_closed',
      orientation: 'EAST',
      angleDegrees: 90,
      isVertical: false,
    };
  }

  /**
   * Pre-computes and returns a Map of coordinate keys ("x,y") to AutotileResults for all wall tiles.
   */
  public static solveAllWalls(
    grid: Grid,
    outOfBoundsIsSolid: boolean = true,
  ): Map<string, AutotileResult> {
    const results = new Map<string, AutotileResult>();
    for (let y = 0; y < grid.height; y++) {
      for (let x = 0; x < grid.width; x++) {
        const tile = grid.getTile(x, y);
        if (tile && tile.terrain === 'wall') {
          results.set(`${x},${y}`, AutotileSolver.resolveWallTile(grid, x, y, outOfBoundsIsSolid));
        }
      }
    }
    return results;
  }
}
