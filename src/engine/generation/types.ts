/**
 * Configuration for dungeon generation.
 */
export interface GeneratorConfig {
  /** Grid width in tiles. */
  width: number;
  /** Grid height in tiles. */
  height: number;
  /** Seed string for reproducible RNG. */
  seed: string;
  /** Minimum room size including walls (interior = minRoomSize - 2). Default 5. */
  minRoomSize?: number;
  /** Maximum room size including walls. Default 12. */
  maxRoomSize?: number;
  /** Minimum number of rooms to generate. Default 5. */
  minRooms?: number;
  /** Maximum BSP recursion depth. Default 8. */
  maxSplitDepth?: number;
  /** Corridor width in tiles. Default 1. */
  corridorWidth?: number;
}

/**
 * A room carved into the dungeon.
 * Coordinates represent the interior floor area (excluding walls).
 */
export interface Room {
  /** Top-left x of interior. */
  x: number;
  /** Top-left y of interior. */
  y: number;
  /** Interior width. */
  width: number;
  /** Interior height. */
  height: number;
  /** Center x coordinate (floored). */
  centerX: number;
  /** Center y coordinate (floored). */
  centerY: number;
}

/**
 * A corridor connecting two rooms.
 */
export interface Corridor {
  /** Ordered list of tile positions forming the corridor. */
  points: Array<{ x: number; y: number }>;
}

/**
 * Result of the BSP generation algorithm.
 */
export interface GeneratorResult {
  /** All rooms carved into the dungeon. */
  rooms: Room[];
  /** All corridors connecting rooms. */
  corridors: Corridor[];
  /** Door positions where corridors meet room edges. */
  doors: Array<{ x: number; y: number }>;
}
