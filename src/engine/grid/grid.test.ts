import { describe, it, expect, beforeEach } from 'vitest';
import { Grid } from './grid';

describe('Grid', () => {
  let grid: Grid;
  const WIDTH = 10;
  const HEIGHT = 10;

  beforeEach(() => {
    grid = new Grid(WIDTH, HEIGHT);
  });

  describe('Initialization', () => {
    it('should create a grid with correct dimensions', () => {
      expect(grid.width).toBe(WIDTH);
      expect(grid.height).toBe(HEIGHT);
    });

    it('should initialize all tiles with default values', () => {
      for (let y = 0; y < HEIGHT; y++) {
        for (let x = 0; x < WIDTH; x++) {
          const tile = grid.getTile(x, y);
          expect(tile).toBeDefined();
          expect(tile?.terrain).toBe('floor');
          expect(tile?.walkable).toBe(true);
          expect(tile?.transparent).toBe(true);
          expect(tile?.entities.size).toBe(0);
          expect(tile?.items.size).toBe(0);
        }
      }
    });
  });

  describe('Bounds and Access', () => {
    it('should correctly report inBounds', () => {
      expect(grid.inBounds(0, 0)).toBe(true);
      expect(grid.inBounds(WIDTH - 1, HEIGHT - 1)).toBe(true);
      expect(grid.inBounds(-1, 0)).toBe(false);
      expect(grid.inBounds(0, -1)).toBe(false);
      expect(grid.inBounds(WIDTH, 0)).toBe(false);
      expect(grid.inBounds(0, HEIGHT)).toBe(false);
    });

    it('should return undefined for out-of-bounds getTile', () => {
      expect(grid.getTile(-1, 0)).toBeUndefined();
      expect(grid.getTile(WIDTH, 0)).toBeUndefined();
    });

    it('should update tile properties with setTile', () => {
      grid.setTile(5, 5, { terrain: 'wall', walkable: false, transparent: false });
      const tile = grid.getTile(5, 5);
      expect(tile?.terrain).toBe('wall');
      expect(tile?.walkable).toBe(false);
      expect(tile?.transparent).toBe(false);
    });
  });

  describe('Walkability and Transparency', () => {
    it('should return true for default walkable tile', () => {
      expect(grid.isWalkable(0, 0)).toBe(true);
    });

    it('should return false for non-walkable tile', () => {
      grid.setTile(1, 1, { walkable: false });
      expect(grid.isWalkable(1, 1)).toBe(false);
    });

    it('should return false for out-of-bounds walkability', () => {
      expect(grid.isWalkable(-1, -1)).toBe(false);
    });

    it('should return true for default transparent tile', () => {
      expect(grid.isTransparent(0, 0)).toBe(true);
    });

    it('should return false for non-transparent tile', () => {
      grid.setTile(2, 2, { transparent: false });
      expect(grid.isTransparent(2, 2)).toBe(false);
    });

    it('should return false for out-of-bounds transparency', () => {
      expect(grid.isTransparent(-1, -1)).toBe(false);
    });
  });

  describe('Spatial Indexing (Entities)', () => {
    const ENTITY_ID = 123;

    it('should add and retrieve entities', () => {
      grid.addEntity(ENTITY_ID, 3, 4);
      const entities = grid.getEntitiesAt(3, 4);
      expect(entities.has(ENTITY_ID)).toBe(true);
      expect(entities.size).toBe(1);
    });

    it('should remove entities', () => {
      grid.addEntity(ENTITY_ID, 3, 4);
      grid.removeEntity(ENTITY_ID, 3, 4);
      const entities = grid.getEntitiesAt(3, 4);
      expect(entities.has(ENTITY_ID)).toBe(false);
      expect(entities.size).toBe(0);
    });

    it('should move entities', () => {
      grid.addEntity(ENTITY_ID, 0, 0);
      grid.moveEntity(ENTITY_ID, 0, 0, 1, 1);
      
      expect(grid.getEntitiesAt(0, 0).has(ENTITY_ID)).toBe(false);
      expect(grid.getEntitiesAt(1, 1).has(ENTITY_ID)).toBe(true);
    });

    it('should support multiple entities on same tile', () => {
      grid.addEntity(1, 5, 5);
      grid.addEntity(2, 5, 5);
      const entities = grid.getEntitiesAt(5, 5);
      expect(entities.size).toBe(2);
      expect(entities.has(1)).toBe(true);
      expect(entities.has(2)).toBe(true);
    });
  });

  describe('Spatial Indexing (Items)', () => {
    const ITEM_ID = 999;

    it('should add and retrieve items', () => {
      grid.addItem(ITEM_ID, 7, 2);
      const items = grid.getItemsAt(7, 2);
      expect(items.has(ITEM_ID)).toBe(true);
      expect(items.size).toBe(1);
    });

    it('should remove items', () => {
      grid.addItem(ITEM_ID, 7, 2);
      grid.removeItem(ITEM_ID, 7, 2);
      const items = grid.getItemsAt(7, 2);
      expect(items.has(ITEM_ID)).toBe(false);
      expect(items.size).toBe(0);
    });

    it('should keep entities and items separate', () => {
      grid.addEntity(1, 2, 2);
      grid.addItem(10, 2, 2);
      
      expect(grid.getEntitiesAt(2, 2).has(1)).toBe(true);
      expect(grid.getEntitiesAt(2, 2).has(10)).toBe(false);
      expect(grid.getItemsAt(2, 2).has(10)).toBe(true);
      expect(grid.getItemsAt(2, 2).has(1)).toBe(false);
    });
  });
});
