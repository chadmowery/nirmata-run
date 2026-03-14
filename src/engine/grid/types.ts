import { EntityId } from '../ecs/types';

/**
 * Represents a single tile in the 2D grid.
 */
export interface Tile {
  /** The type of terrain on this tile (e.g., 'floor', 'wall'). */
  terrain: string;
  /** Whether entities can walk on this tile. */
  walkable: boolean;
  /** Whether line-of-sight can pass through this tile. */
  transparent: boolean;
  /** Set of entity IDs currently on this tile's entity layer. */
  entities: Set<EntityId>;
  /** Set of entity IDs currently on this tile's item layer. */
  items: Set<EntityId>;
}

/**
 * Configuration for initializing a grid.
 */
export interface GridConfig {
  width: number;
  height: number;
}

/**
 * Factory function to create a default tile.
 */
export function createDefaultTile(): Tile {
  return {
    terrain: 'floor',
    walkable: true,
    transparent: true,
    entities: new Set<EntityId>(),
    items: new Set<EntityId>(),
  };
}
