import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '../../engine/ecs/world';
import { Grid } from '../../engine/grid/grid';
import { EventBus } from '../../engine/events/event-bus';
import { GameplayEvents } from '../events/types';
import { serializeWorld, deserializeWorld, serializeGrid, deserializeGrid } from '../serialization';
import { Position } from '../../shared/components/position';
import { Health } from '../../shared/components/health';

describe('Serialization', () => {
  let world: World<GameplayEvents>;
  let grid: Grid;
  let eventBus: EventBus<GameplayEvents>;

  beforeEach(() => {
    eventBus = new EventBus();
    world = new World(eventBus);
    grid = new Grid(10, 10);
  });

  describe('World Serialization', () => {
    it('should perform a lossless round-trip for world state', () => {
      const entityId = world.createEntity();
      world.addComponent(entityId, Position, { x: 5, y: 5 });
      world.addComponent(entityId, Health, { current: 10, max: 10 });

      const serialized = serializeWorld(world);
      const newWorld = deserializeWorld(serialized, eventBus);

      expect(newWorld.entityExists(entityId)).toBe(true);
      expect(newWorld.getComponent(entityId, Position)).toEqual({ x: 5, y: 5 });
      expect(newWorld.getComponent(entityId, Health)).toEqual({ current: 10, max: 10 });
      expect(serializeWorld(newWorld)).toEqual(serialized);
    });
  });

  describe('Grid Serialization', () => {
    it('should perform a lossless round-trip for grid state', () => {
      grid.setTile(1, 1, { terrain: 'wall', walkable: false, transparent: false });
      grid.addEntity(100, 1, 1);
      grid.addItem(200, 1, 1);

      const serialized = serializeGrid(grid);
      const newGrid = deserializeGrid(serialized);

      expect(newGrid.width).toBe(10);
      expect(newGrid.height).toBe(10);
      expect(newGrid.getTile(1, 1)?.terrain).toBe('wall');
      expect(newGrid.getTile(1, 1)?.walkable).toBe(false);
      expect(Array.from(newGrid.getEntitiesAt(1, 1))).toContain(100);
      expect(Array.from(newGrid.getItemsAt(1, 1))).toContain(200);
      expect(serializeGrid(newGrid)).toEqual(serialized);
    });
  });
});
