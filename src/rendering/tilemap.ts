import { CompositeTilemap } from '@pixi/tilemap';
import { TILE_SIZE } from './constants';

// Interfaces based on expected engine/game structures
export interface Grid {
  width: number;
  height: number;
  getTile(x: number, y: number): { terrain: number; walkable: boolean } | undefined;
}

export enum TileType {
  Floor = 0,
  Wall = 1,
  Door = 2,
}

export interface BuildTilemapOptions {
  visibleRange?: { startX: number; startY: number; endX: number; endY: number };
  fovSet?: Set<string>;
  exploredSet?: Set<string>;
  playerPos?: { x: number; y: number };
}

/**
 * Maps engine terrain type to tileset frame name.
 */
export function tileTerrainToFrame(terrain: number): string {
  switch (terrain) {
    case TileType.Wall:
      return 'wall';
    case TileType.Door:
      return 'door';
    case TileType.Floor:
    default:
      return 'floor';
  }
}

/**
 * Computes alpha for a tile based on FOV and exploration state.
 */
function computeAlpha(
  x: number,
  y: number,
  options?: BuildTilemapOptions
): number {
  if (!options || (!options.fovSet && !options.exploredSet)) {
    return 1.0;
  }

  const key = `${x},${y}`;

  if (options.fovSet?.has(key)) {
    // Basic brightness for visible tiles (gradient can be added later)
    return 1.0;
  }

  if (options.exploredSet?.has(key)) {
    return 0.3; // Heavy dim for explored but not visible
  }

  return 0.0; // Hidden
}

/**
 * Builds the CompositeTilemap from grid data.
 * Adheres to build-once/refresh pattern.
 */
export function buildTilemap(
  grid: Grid,
  tilemap: CompositeTilemap,
  options?: BuildTilemapOptions
): void {
  tilemap.clear();

  const startX = options?.visibleRange?.startX ?? 0;
  const startY = options?.visibleRange?.startY ?? 0;
  const endX = options?.visibleRange?.endX ?? grid.width - 1;
  const endY = options?.visibleRange?.endY ?? grid.height - 1;

  for (let y = startY; y <= endY; y++) {
    for (let x = startX; x <= endX; x++) {
      const tile = grid.getTile(x, y);
      if (!tile) continue;

      const alpha = computeAlpha(x, y, options);
      if (alpha <= 0) continue;

      const frame = tileTerrainToFrame(tile.terrain);
      tilemap.tile(frame, x * TILE_SIZE, y * TILE_SIZE, { alpha });
    }
  }
}
