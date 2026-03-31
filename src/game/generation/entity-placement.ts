import { World } from '../../engine/ecs/world';
import { Grid } from '../../engine/grid/grid';
import { EntityFactory } from '../../engine/entity/factory';
import { EntityId } from '../../engine/ecs/types';
import { ComponentRegistry } from '../../engine/entity/types';
import { Room } from '../../engine/generation/types';
import depthDistribution from '../entities/templates/spawn-tables/depth-distribution.json';

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
  /** Optional overrides for the player entity. */
  playerOverrides?: Record<string, Record<string, unknown>>;
  /** Current floor depth for depth-based spawning. */
  depth?: number;
}

interface SpawnTableEntry {
  name: string;
  weight: number;
  isPack?: boolean;
  packSize?: { min: number; max: number };
  maxPerFloor?: number;
  minDistanceFromPlayer?: number;
}

interface DepthTable {
  depthRange: { min: number; max: number };
  enemiesPerRoom: { min: number; max: number };
  templates: SpawnTableEntry[];
}

const DEFAULT_PLACEMENT: PlacementConfig = {
  enemiesPerRoom: { min: 1, max: 3 },
  itemsPerRoom: { min: 0, max: 2 },
  enemyTemplates: ['goblin'],
  itemTemplates: ['health_potion'],
  playerOverrides: {}
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

function getTableForDepth(depth: number): DepthTable | undefined {
  return (depthDistribution.tables as unknown as DepthTable[]).find(
    (table) => depth >= table.depthRange.min && depth <= table.depthRange.max
  );
}

function selectWeightedTemplate(templates: SpawnTableEntry[], rng: { random(): number }): SpawnTableEntry | undefined {
  const totalWeight = templates.reduce((sum, t) => sum + t.weight, 0);
  let random = rng.random() * totalWeight;
  for (const template of templates) {
    if (random < template.weight) {
      return template;
    }
    random -= template.weight;
  }
  return undefined;
}

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

  const depthTable = cfg.depth !== undefined ? getTableForDepth(cfg.depth) : undefined;
  const enemiesPerRoom = depthTable ? depthTable.enemiesPerRoom : cfg.enemiesPerRoom;
  const spawnedCountPerTemplate: Record<string, number> = {};

  // Place player at spawn room center
  const playerOverrides = {
    ...cfg.playerOverrides,
    position: { x: spawnRoom.centerX, y: spawnRoom.centerY } as unknown as Record<string, unknown>,
  };

  const playerId = factory.create(world, 'player', componentRegistry, playerOverrides);
  grid.addEntity(playerId, spawnRoom.centerX, spawnRoom.centerY);

  // Place enemies and items in non-spawn rooms
  for (const room of rooms) {
    if (room === spawnRoom) continue;

    // Collect walkable positions in this room (excluding positions already occupied)
    const walkablePositions = getWalkablePositions(grid, room);

    // Spawn enemies
    const enemyCount = randomIntRange(rng, enemiesPerRoom.min, enemiesPerRoom.max);
    for (let i = 0; i < enemyCount && walkablePositions.length > 0; i++) {
      const entry = depthTable
        ? selectWeightedTemplate(depthTable.templates, rng)
        : { name: cfg.enemyTemplates[Math.floor(rng.random() * cfg.enemyTemplates.length)], weight: 1 };

      if (!entry) continue;

      // Check maxPerFloor constraint
      if (entry.maxPerFloor !== undefined) {
        const currentCount = spawnedCountPerTemplate[entry.name] || 0;
        if (currentCount >= entry.maxPerFloor) continue;
      }

      // Check minDistanceFromPlayer constraint
      if (entry.minDistanceFromPlayer !== undefined) {
        const dx = Math.abs(room.centerX - spawnRoom.centerX);
        const dy = Math.abs(room.centerY - spawnRoom.centerY);
        const dist = dx + dy; // Manhattan distance
        if (dist < entry.minDistanceFromPlayer) continue;
      }

      if (entry.isPack) {
        const packSize = randomIntRange(rng, entry.packSize?.min || 1, entry.packSize?.max || 1);
        const packId = `pack-${room.x}-${room.y}`;

        for (let p = 0; p < packSize && walkablePositions.length > 0; p++) {
          const posIdx = Math.floor(rng.random() * walkablePositions.length);
          const pos = walkablePositions.splice(posIdx, 1)[0];

          const enemyId = factory.create(world, entry.name, componentRegistry, {
            position: { x: pos.x, y: pos.y },
            packMember: { packId, isLeader: p === 0 },
          });
          grid.addEntity(enemyId, pos.x, pos.y);
          enemyIds.push(enemyId);
          spawnedCountPerTemplate[entry.name] = (spawnedCountPerTemplate[entry.name] || 0) + 1;
        }
      } else {
        const posIdx = Math.floor(rng.random() * walkablePositions.length);
        const pos = walkablePositions.splice(posIdx, 1)[0];

        const enemyId = factory.create(world, entry.name, componentRegistry, {
          position: { x: pos.x, y: pos.y },
        });
        grid.addEntity(enemyId, pos.x, pos.y);
        enemyIds.push(enemyId);
        spawnedCountPerTemplate[entry.name] = (spawnedCountPerTemplate[entry.name] || 0) + 1;
      }
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
