import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '../../engine/ecs/world';
import { Grid } from '../../engine/grid/grid';
import { EventBus } from '../../engine/events/event-bus';
import { EngineEvents } from '../../engine/events/types';
import { EntityRegistry } from '../../engine/entity/registry';
import { EntityFactory } from '../../engine/entity/factory';
import { ComponentRegistry } from '../../engine/entity/types';
import { registerGameTemplates } from '../entities';
import * as Components from '../components';
import { Room } from '../../engine/generation/types';
import { placeEntities, PlacementConfig } from './entity-placement';

const { Position } = Components;

function makeComponentRegistry(): ComponentRegistry {
  return {
    get: (key: string) =>
      Object.values(Components).find(
        (c) => c && typeof c === 'object' && 'key' in c && (c as any).key === key
      ) as any,
    has: (key: string) =>
      Object.values(Components).some(
        (c) => c && typeof c === 'object' && 'key' in c && (c as any).key === key
      ),
  };
}

/**
 * Create a simple seeded RNG for deterministic tests.
 */
function createRng(seed: number = 42) {
  let s = seed;
  return {
    random: () => {
      s = (s * 16807 + 0) % 2147483647;
      return (s - 1) / 2147483646;
    },
  };
}

/**
 * Create test rooms with a walkable grid.
 */
function setupDungeon() {
  const grid = new Grid(30, 30);
  // Initialize all as walls
  for (let y = 0; y < 30; y++) {
    for (let x = 0; x < 30; x++) {
      grid.setTile(x, y, { terrain: 'wall', walkable: false, transparent: false });
    }
  }

  // Spawn room (first room)
  const spawnRoom: Room = { x: 2, y: 2, width: 5, height: 5, centerX: 4, centerY: 4 };
  // Non-spawn rooms
  const room2: Room = { x: 15, y: 2, width: 5, height: 5, centerX: 17, centerY: 4 };
  const room3: Room = { x: 2, y: 15, width: 5, height: 5, centerX: 4, centerY: 17 };

  const rooms = [spawnRoom, room2, room3];

  // Carve rooms as walkable
  for (const room of rooms) {
    for (let y = room.y; y < room.y + room.height; y++) {
      for (let x = room.x; x < room.x + room.width; x++) {
        grid.setTile(x, y, { terrain: 'floor', walkable: true, transparent: true });
      }
    }
  }

  return { grid, rooms, spawnRoom, room2, room3 };
}

describe('placeEntities', () => {
  let world: World;
  let factory: EntityFactory;
  let componentRegistry: ComponentRegistry;

  beforeEach(() => {
    const eventBus = new EventBus<EngineEvents>();
    world = new World(eventBus);
    const registry = new EntityRegistry();
    registerGameTemplates(registry);
    factory = new EntityFactory(registry);
    componentRegistry = makeComponentRegistry();
  });

  it('should place player at spawn room center', () => {
    const { grid, rooms, spawnRoom } = setupDungeon();
    const rng = createRng();

    const result = placeEntities(world, grid, factory, componentRegistry, rooms, spawnRoom, rng);

    const pos = world.getComponent(result.playerId, Position);
    expect(pos).toEqual({ x: spawnRoom.centerX, y: spawnRoom.centerY });
  });

  it('should place enemies only in non-spawn rooms', () => {
    const { grid, rooms, spawnRoom } = setupDungeon();
    const rng = createRng();

    const result = placeEntities(world, grid, factory, componentRegistry, rooms, spawnRoom, rng);

    // No enemies should be in spawn room
    for (const enemyId of result.enemyIds) {
      const pos = world.getComponent(enemyId, Position)!;
      const inSpawnRoom =
        pos.x >= spawnRoom.x &&
        pos.x < spawnRoom.x + spawnRoom.width &&
        pos.y >= spawnRoom.y &&
        pos.y < spawnRoom.y + spawnRoom.height;
      expect(inSpawnRoom).toBe(false);
    }
  });

  it('should place enemies within configured range per room', () => {
    const { grid, rooms, spawnRoom } = setupDungeon();
    const rng = createRng();
    const placementConfig: Partial<PlacementConfig> = {
      enemiesPerRoom: { min: 1, max: 2 },
    };

    const result = placeEntities(
      world, grid, factory, componentRegistry, rooms, spawnRoom, rng, placementConfig
    );

    // 2 non-spawn rooms, 1-2 enemies each → 2-4 total
    expect(result.enemyIds.length).toBeGreaterThanOrEqual(2);
    expect(result.enemyIds.length).toBeLessThanOrEqual(4);
  });

  it('should place items at walkable positions', () => {
    const { grid, rooms, spawnRoom } = setupDungeon();
    const rng = createRng();

    const result = placeEntities(world, grid, factory, componentRegistry, rooms, spawnRoom, rng);

    for (const itemId of result.itemIds) {
      const pos = world.getComponent(itemId, Position)!;
      expect(grid.isWalkable(pos.x, pos.y)).toBe(true);
    }
  });

  it('should give all entities Position components matching grid positions', () => {
    const { grid, rooms, spawnRoom } = setupDungeon();
    const rng = createRng();

    const result = placeEntities(world, grid, factory, componentRegistry, rooms, spawnRoom, rng);

    // Player should be on grid
    const playerPos = world.getComponent(result.playerId, Position)!;
    expect(grid.getEntitiesAt(playerPos.x, playerPos.y).has(result.playerId)).toBe(true);

    // Enemies should be on grid
    for (const enemyId of result.enemyIds) {
      const pos = world.getComponent(enemyId, Position)!;
      expect(grid.getEntitiesAt(pos.x, pos.y).has(enemyId)).toBe(true);
    }
  });

  it('should produce same placements with same seed', () => {
    const { grid, rooms, spawnRoom } = setupDungeon();

    const result1 = placeEntities(
      world, grid, factory, componentRegistry, rooms, spawnRoom, createRng(99)
    );

    // Reset world for second run
    const eventBus2 = new EventBus<EngineEvents>();
    const world2 = new World(eventBus2);
    const { grid: grid2, rooms: rooms2, spawnRoom: spawnRoom2 } = setupDungeon();

    const result2 = placeEntities(
      world2, grid2, factory, componentRegistry, rooms2, spawnRoom2, createRng(99)
    );

    // Same number of enemies and items
    expect(result1.enemyIds.length).toBe(result2.enemyIds.length);
    expect(result1.itemIds.length).toBe(result2.itemIds.length);

    // Same positions
    for (let i = 0; i < result1.enemyIds.length; i++) {
      const pos1 = world.getComponent(result1.enemyIds[i], Position);
      const pos2 = world2.getComponent(result2.enemyIds[i], Position);
      expect(pos1).toEqual(pos2);
    }
  });

  it('should not place entities on walls or out of bounds', () => {
    const { grid, rooms, spawnRoom } = setupDungeon();
    const rng = createRng();

    const result = placeEntities(world, grid, factory, componentRegistry, rooms, spawnRoom, rng);

    const allIds = [result.playerId, ...result.enemyIds, ...result.itemIds];
    for (const id of allIds) {
      const pos = world.getComponent(id, Position)!;
      expect(pos).toBeDefined();
      expect(grid.inBounds(pos.x, pos.y)).toBe(true);
      expect(grid.isWalkable(pos.x, pos.y)).toBe(true);
    }
  });
});
