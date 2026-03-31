import { Grid } from '../../engine/grid/grid';
import { GeneratorConfig, Room } from '../../engine/generation/types';
import { generateBSP } from '../../engine/generation/bsp';
import { validateConnectivity } from '../../engine/generation/flood-fill';
import depthConfig from './depth-config.json';

/**
 * Configuration for game-layer dungeon generation.
 * Extends engine GeneratorConfig with optional depth field.
 */
export interface DungeonConfig extends GeneratorConfig {
  /** Current floor depth for depth-specific parameters. */
  depth?: number;
}

/**
 * Result of a dungeon generation.
 */
export interface DungeonResult {
  /** The populated grid with carved rooms, corridors, and doors. */
  grid: Grid;
  /** All rooms generated. */
  rooms: Room[];
  /** Door positions. */
  doors: Array<{ x: number; y: number }>;
  /** The room designated as the player spawn point. */
  playerSpawnRoom: Room;
}

const MAX_ATTEMPTS = 10;

/**
 * Get the depth band configuration for a given floor depth.
 */
export function getDepthBand(depth: number) {
  return depthConfig.depthBands.find(
    band => depth >= band.range.min && depth <= band.range.max
  );
}

/**
 * Generate a dungeon: create a Grid, run BSP, carve terrain, validate connectivity.
 * Retries with modified seeds if connectivity check fails (max 10 attempts).
 *
 * @param config Dungeon generation configuration
 * @returns DungeonResult with grid, rooms, doors, and spawn room
 * @throws Error if a connected dungeon cannot be generated after max attempts
 */
export function generateDungeon(config: DungeonConfig): DungeonResult {
  const depthBand = config.depth !== undefined ? getDepthBand(config.depth) : undefined;
  
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const attemptSeed = attempt === 0 ? config.seed : `${config.seed}_${attempt}`;
    
    // Merge BSP parameters from depth band if available
    const attemptConfig = { 
      ...config, 
      seed: attemptSeed,
      ...(depthBand ? depthBand.bspConfig : {})
    };

    // Run BSP algorithm
    const { rooms, corridors, doors } = generateBSP(attemptConfig);

    if (rooms.length === 0) continue;

    // Create grid and initialize all tiles as walls
    const grid = new Grid(config.width, config.height);
    initializeWalls(grid, config.width, config.height);

    // Carve room interiors as floors
    for (const room of rooms) {
      for (let y = room.y; y < room.y + room.height; y++) {
        for (let x = room.x; x < room.x + room.width; x++) {
          grid.setTile(x, y, { terrain: 'floor', walkable: true, transparent: true });
        }
      }
    }

    // Carve corridors as floors
    for (const corridor of corridors) {
      for (const pt of corridor.points) {
        if (grid.inBounds(pt.x, pt.y)) {
          grid.setTile(pt.x, pt.y, { terrain: 'floor', walkable: true, transparent: true });
        }
      }
    }

    // Carve doors
    for (const door of doors) {
      if (grid.inBounds(door.x, door.y)) {
        grid.setTile(door.x, door.y, { terrain: 'door', walkable: true, transparent: true });
      }
    }

    // Player spawn room is the first room (deterministic from seed)
    const playerSpawnRoom = rooms[0];

    // Validate connectivity from spawn room center
    const connectivity = validateConnectivity(
      config.width,
      config.height,
      (x, y) => grid.isWalkable(x, y),
      playerSpawnRoom.centerX,
      playerSpawnRoom.centerY
    );

    if (connectivity.connected) {
      return { grid, rooms, doors, playerSpawnRoom };
    }
  }

  throw new Error('Failed to generate connected dungeon');
}

/**
 * Initialize all grid tiles as walls.
 */
function initializeWalls(grid: Grid, width: number, height: number): void {
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      grid.setTile(x, y, { terrain: 'wall', walkable: false, transparent: false });
    }
  }
}
