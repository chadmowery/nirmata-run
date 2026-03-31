import { EntityId } from '../ecs/types';
import { Tile, createDefaultTile } from './types';
import { SerializedTile } from '@shared/types';

/**
 * A 2D grid for managing spatial data, including terrain, entities, and items.
 * Uses a flat array for efficient storage and access.
 */
export class Grid {
  private tiles: Tile[];
  public readonly width: number;
  public readonly height: number;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.tiles = Array.from({ length: width * height }, () => createDefaultTile());
  }

  /**
   * Resets all tiles in the grid to their default state.
   */
  public clear(): void {
    for (let i = 0; i < this.tiles.length; i++) {
      this.tiles[i] = createDefaultTile();
    }
  }

  /**
   * Converts x, y coordinates to a flat array index.
   */
  private toIndex(x: number, y: number): number {
    return y * this.width + x;
  }

  /**
   * Checks if the given coordinates are within the grid bounds.
   */
  public inBounds(x: number, y: number): boolean {
    return x >= 0 && x < this.width && y >= 0 && y < this.height;
  }

  /**
   * Returns the tile at the given coordinates, or undefined if out of bounds.
   */
  public getTile(x: number, y: number): Tile | undefined {
    if (!this.inBounds(x, y)) return undefined;
    return this.tiles[this.toIndex(x, y)];
  }

  /**
   * Merges partial tile data into the tile at the given coordinates.
   */
  public setTile(x: number, y: number, partial: Partial<Omit<Tile, 'entities' | 'items'>>): void {
    const tile = this.getTile(x, y);
    if (tile) {
      Object.assign(tile, partial);
    }
  }

  /**
   * Returns whether the tile at the given coordinates is walkable.
   */
  public isWalkable(x: number, y: number): boolean {
    return this.getTile(x, y)?.walkable ?? false;
  }

  /**
   * Returns whether the tile at the given coordinates is transparent.
   */
  public isTransparent(x: number, y: number): boolean {
    return this.getTile(x, y)?.transparent ?? false;
  }

  /**
   * Returns the set of entities at the given coordinates.
   */
  public getEntitiesAt(x: number, y: number): Set<EntityId> {
    return this.getTile(x, y)?.entities ?? new Set<EntityId>();
  }

  /**
   * Adds an entity to the given coordinates.
   */
  public addEntity(entityId: EntityId, x: number, y: number): void {
    const tile = this.getTile(x, y);
    if (tile) {
      tile.entities.add(entityId);
    }
  }

  /**
   * Removes an entity from the given coordinates.
   */
  public removeEntity(entityId: EntityId, x: number, y: number): void {
    const tile = this.getTile(x, y);
    if (tile) {
      tile.entities.delete(entityId);
    }
  }

  /**
   * Moves an entity from one set of coordinates to another.
   */
  public moveEntity(entityId: EntityId, fromX: number, fromY: number, toX: number, toY: number): void {
    this.removeEntity(entityId, fromX, fromY);
    this.addEntity(entityId, toX, toY);
  }

  /**
   * Returns the set of items at the given coordinates.
   */
  public getItemsAt(x: number, y: number): Set<EntityId> {
    return this.getTile(x, y)?.items ?? new Set<EntityId>();
  }

  /**
   * Adds an item to the given coordinates.
   */
  public addItem(itemId: EntityId, x: number, y: number): void {
    const tile = this.getTile(x, y);
    if (tile) {
      tile.items.add(itemId);
    }
  }

  /**
   * Removes an item from the given coordinates.
   */
  public removeItem(itemId: EntityId, x: number, y: number): void {
    const tile = this.getTile(x, y);
    if (tile) {
      tile.items.delete(itemId);
    }
  }

  /**
   * Returns a copy of the internal tiles for serialization.
   */
  getSerializableTiles(): SerializedTile[] {
    return this.tiles.map(tile => ({
      ...tile,
      entities: Array.from(tile.entities),
      items: Array.from(tile.items),
    }));
  }

  /**
   * Loads tiles into the grid.
   */
  loadSerializableTiles(serializedTiles: SerializedTile[]): void {
    if (serializedTiles.length !== this.tiles.length) {
      throw new Error('Serialized tile count does not match grid size');
    }

    for (let i = 0; i < serializedTiles.length; i++) {
      const sTile = serializedTiles[i];
      this.tiles[i] = {
        ...sTile,
        entities: new Set(sTile.entities),
        items: new Set(sTile.items),
      };
    }
  }
}
