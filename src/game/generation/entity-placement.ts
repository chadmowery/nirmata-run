import { World } from '../../engine/ecs/world';
import { Grid } from '../../engine/grid/grid';
import { EntityFactory } from '../../engine/entity/factory';
import { EntityId } from '../../engine/ecs/types';
import { ComponentRegistry } from '../../engine/entity/types';
import { Room } from '../../engine/generation/types';

/**
 * Configuration for entity placement in generated dungeons.
 */
export interface PlacementConfig {
  /** Range of enemies per non-spawn room. */
  enemiesPerRoom: { min: number; max: number };
  /** Range of items per non-spawn room. */
  itemsPerRoom: { min: number; max: number };
  /** Template names for enemy entities. */
  enemyTemplates: string[];
  /** Template names for item entities. */
  itemTemplates: string[];
}

const DEFAULT_PLACEMENT: PlacementConfig = {
  enemiesPerRoom: { min: 1, max: 3 },
  itemsPerRoom: { min: 0, max: 2 },
  enemyTemplates: ['goblin'],
  itemTemplates: ['health_potion'],
};

/**
 * Result of entity placement.
 */
export interface PlacementResult {
  playerId: EntityId;
  enemyIds: EntityId[];
  itemIds: EntityId[];
}

import { EngineEvents } from '../../engine/events/types';

/**
 * Place player, enemies, and items in a generated dungeon.
 *
 * @param world ECS world
 * @param grid Dungeon grid
 * @param factory Entity factory for creating from templates
 * @param componentRegistry Component registry for factory
 * @param rooms All dungeon rooms
 * @param spawnRoom Player's spawn room
 * @param rng Seeded RNG with a random() method returning [0, 1)
 * @param config Optional placement configuration
 * @returns IDs of all placed entities
 */
export function placeEntities<T extends EngineEvents>(
  world: World<T>,
  grid: Grid,
  factory: EntityFactory,
  componentRegistry: ComponentRegistry,
  rooms: Room[],
  spawnRoom: Room,
  rng: { random(): number },
  config?: Partial<PlacementConfig>
): PlacementResult {
  const cfg: PlacementConfig = { ...DEFAULT_PLACEMENT, ...config };
  const enemyIds: EntityId[] = [];
  const itemIds: EntityId[] = [];

  // Place player at spawn room center
  const playerId = factory.create(world, 'player', componentRegistry, {
    position: { x: spawnRoom.centerX, y: spawnRoom.centerY },
  });
  grid.addEntity(playerId, spawnRoom.centerX, spawnRoom.centerY);

  // Place enemies and items in non-spawn rooms
  for (const room of rooms) {
    if (room === spawnRoom) continue;

    // Collect walkable positions in this room (excluding positions already occupied)
    const walkablePositions = getWalkablePositions(grid, room);

    // Spawn enemies
    const enemyCount = randomIntRange(rng, cfg.enemiesPerRoom.min, cfg.enemiesPerRoom.max);
    for (let i = 0; i < enemyCount && walkablePositions.length > 0; i++) {
      const posIdx = Math.floor(rng.random() * walkablePositions.length);
      const pos = walkablePositions.splice(posIdx, 1)[0];
      const templateName = cfg.enemyTemplates[Math.floor(rng.random() * cfg.enemyTemplates.length)];

      const enemyId = factory.create(world, templateName, componentRegistry, {
        position: { x: pos.x, y: pos.y },
      });
      grid.addEntity(enemyId, pos.x, pos.y);
      enemyIds.push(enemyId);
    }

    // Spawn items
    const itemCount = randomIntRange(rng, cfg.itemsPerRoom.min, cfg.itemsPerRoom.max);
    for (let i = 0; i < itemCount && walkablePositions.length > 0; i++) {
      const posIdx = Math.floor(rng.random() * walkablePositions.length);
      const pos = walkablePositions.splice(posIdx, 1)[0];
      const templateName = cfg.itemTemplates[Math.floor(rng.random() * cfg.itemTemplates.length)];

      const itemId = factory.create(world, templateName, componentRegistry, {
        position: { x: pos.x, y: pos.y },
      });
      grid.addItem(itemId, pos.x, pos.y);
      itemIds.push(itemId);
    }
  }

  return { playerId, enemyIds, itemIds };
}

/**
 * Get all walkable positions within a room.
 */
function getWalkablePositions(grid: Grid, room: Room): Array<{ x: number; y: number }> {
  const positions: Array<{ x: number; y: number }> = [];
  for (let y = room.y; y < room.y + room.height; y++) {
    for (let x = room.x; x < room.x + room.width; x++) {
      if (grid.isWalkable(x, y)) {
        positions.push({ x, y });
      }
    }
  }
  return positions;
}

/**
 * Random integer in [min, max] inclusive.
 */
function randomIntRange(rng: { random(): number }, min: number, max: number): number {
  if (min >= max) return min;
  return min + Math.floor(rng.random() * (max - min + 1));
}
