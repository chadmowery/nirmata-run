import { World } from '@engine/ecs/world';
import { Grid } from '@engine/grid/grid';
import { EventBus } from '@engine/events/event-bus';
import { EntityId } from '@engine/ecs/types';
import { Position } from '@shared/components/position';
import { Actor } from '@shared/components/actor';
import { CorruptionState } from '@shared/components/corruption-state';
import { GameplayEvents } from '@shared/events/types';
import { EntityFactory } from '@engine/entity/factory';
import { ComponentRegistry } from '@engine/entity/types';

/**
 * System that handles tile corruption spread and subprocess spawning for Seed_Eater.
 */
export function createTileCorruptionSystem<T extends GameplayEvents>(
  world: World<T>,
  grid: Grid,
  eventBus: EventBus<T>,
  entityFactory: EntityFactory,
  componentRegistry: ComponentRegistry
) {

  function getPlayerEntity(): { id: EntityId; x: number; y: number } | null {
    const actors = world.query(Actor, Position);
    for (const id of actors) {
      const actor = world.getComponent(id, Actor);
      if (actor?.isPlayer) {
        const pos = world.getComponent(id, Position)!;
        return { id, x: pos.x, y: pos.y };
      }
    }
    return null;
  }

  function getTilesAtDistance(startX: number, startY: number, distance: number): Array<{ x: number; y: number }> {
    const tiles: Array<{ x: number; y: number }> = [];
    const visited = new Set<string>();
    const queue: Array<{ x: number; y: number; d: number }> = [{ x: startX, y: startY, d: 0 }];
    visited.add(`${startX},${startY}`);

    while (queue.length > 0) {
      const { x, y, d } = queue.shift()!;
      if (d === distance) {
        tiles.push({ x, y });
        continue;
      }
      if (d > distance) continue;

      const neighbors = [
        { x: x + 1, y: y },
        { x: x - 1, y: y },
        { x: x, y: y + 1 },
        { x: x, y: y - 1 },
      ];

      for (const n of neighbors) {
        const key = `${n.x},${n.y}`;
        if (grid.inBounds(n.x, n.y) && !visited.has(key)) {
          visited.add(key);
          queue.push({ ...n, d: d + 1 });
        }
      }
    }
    return tiles;
  }

  function findNearestWalkable(startX: number, startY: number): { x: number; y: number } | null {
    const visited = new Set<string>();
    const queue: Array<{ x: number; y: number }> = [{ x: startX, y: startY }];
    visited.add(`${startX},${startY}`);

    while (queue.length > 0) {
      const { x, y } = queue.shift()!;
      if (grid.isWalkable(x, y)) {
        return { x, y };
      }

      const neighbors = [
        { x: x + 1, y: y },
        { x: x - 1, y: y },
        { x: x, y: y + 1 },
        { x: x, y: y - 1 },
      ];

      for (const n of neighbors) {
        const key = `${n.x},${n.y}`;
        if (grid.inBounds(n.x, n.y) && !visited.has(key)) {
          visited.add(key);
          queue.push(n);
        }
      }
    }
    return null;
  }

  function isPlayerTrappedAfterCorruption(corruptX: number, corruptY: number): boolean {
    const player = getPlayerEntity();
    if (!player) return false;

    // If corruption is not on player's tile or adjacent, player probably not trapped immediately
    // but better check if player still has at least one walkable neighbor
    const neighbors = [
      { x: player.x + 1, y: player.y },
      { x: player.x - 1, y: player.y },
      { x: player.x, y: player.y + 1 },
      { x: player.x, y: player.y - 1 },
    ];

    let walkableCount = 0;
    for (const n of neighbors) {
      if (grid.inBounds(n.x, n.y)) {
        const isTargetOfCorruption = n.x === corruptX && n.y === corruptY;
        const willBeWalkable = isTargetOfCorruption ? !grid.isWalkable(n.x, n.y) : grid.isWalkable(n.x, n.y);
        if (willBeWalkable) {
          walkableCount++;
        }
      }
    }

    return walkableCount === 0;
  }

  function spreadCorruption(seedEaterId: EntityId) {
    const state = world.getComponent(seedEaterId, CorruptionState);
    const pos = world.getComponent(seedEaterId, Position);
    if (!state || !pos) return;

    let ring = getTilesAtDistance(pos.x, pos.y, state.corruptionWave);
    ring = ring.filter(t => !state.corruptedTileKeys.includes(`${t.x},${t.y}`));

    // If ring is empty, increase wave and try again once
    if (ring.length === 0) {
      state.corruptionWave++;
      ring = getTilesAtDistance(pos.x, pos.y, state.corruptionWave);
      ring = ring.filter(t => !state.corruptedTileKeys.includes(`${t.x},${t.y}`));
    }

    if (ring.length === 0) return;

    // Shuffle ring to pick random tiles
    for (let i = ring.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [ring[i], ring[j]] = [ring[j], ring[i]];
    }

    const toCorrupt = ring.slice(0, state.tilesPerTurn);

    for (const tile of toCorrupt) {
      // Safety check: don't trap player
      if (grid.isWalkable(tile.x, tile.y) && isPlayerTrappedAfterCorruption(tile.x, tile.y)) {
        continue;
      }

      const wasWalkable = grid.isWalkable(tile.x, tile.y);
      const newWalkable = !wasWalkable;
      const newTerrain = newWalkable ? 'floor' : 'wall';
      const newTransparent = newWalkable;

      // Update grid
      grid.setTile(tile.x, tile.y, {
        terrain: newTerrain,
        walkable: newWalkable,
        transparent: newTransparent
      });

      state.corruptedTileKeys.push(`${tile.x},${tile.y}`);
      eventBus.emit('TILE_CORRUPTED', { 
        x: tile.x, 
        y: tile.y, 
        newType: newTerrain as 'wall' | 'floor', 
        corruptorId: seedEaterId 
      });

      // Displace entities if it became a wall
      if (!newWalkable) {
        const entities = Array.from(grid.getEntitiesAt(tile.x, tile.y));
        for (const eid of entities) {
          if (eid === seedEaterId) continue; // Seed_Eater is immune
          
          const target = findNearestWalkable(tile.x, tile.y);
          if (target) {
            const ePos = world.getComponent(eid, Position);
            if (ePos) {
              const fromX = ePos.x;
              const fromY = ePos.y;
              ePos.x = target.x;
              ePos.y = target.y;
              grid.removeEntity(eid, fromX, fromY);
              grid.addEntity(eid, target.x, target.y);
              eventBus.emit('ENTITY_DISPLACED', { 
                entityId: eid, 
                fromX, 
                fromY, 
                toX: target.x, 
                toY: target.y 
              });
            }
          }
        }
      }
    }
  }

  function spawnSubProcess(seedEaterId: EntityId) {
    const pos = world.getComponent(seedEaterId, Position);
    if (!pos) return;

    const templateName = Math.random() < 0.5 ? 'null-pointer' : 'buffer-overflow';
    
    // Find walkable tile within 3 tiles
    const candidates: Array<{ x: number; y: number }> = [];
    for (let dx = -3; dx <= 3; dx++) {
      for (let dy = -3; dy <= 3; dy++) {
        const x = pos.x + dx;
        const y = pos.y + dy;
        if (grid.inBounds(x, y) && grid.isWalkable(x, y) && grid.getEntitiesAt(x, y).size === 0) {
          candidates.push({ x, y });
        }
      }
    }

    if (candidates.length > 0) {
      const spawnPos = candidates[Math.floor(Math.random() * candidates.length)];
      try {
        const childId = entityFactory.create(world, templateName, componentRegistry, {
          position: { x: spawnPos.x, y: spawnPos.y }
        });
        grid.addEntity(childId, spawnPos.x, spawnPos.y);
        eventBus.emit('SUB_PROCESS_SPAWNED', { 
          parentId: seedEaterId, 
          childId, 
          templateName 
        });
        eventBus.emit('MESSAGE_EMITTED', { 
          text: `Seed_Eater spawned a ${templateName}!`, 
          type: 'combat' 
        });
      } catch (e) {
        console.error(`[TileCorruptionSystem] Failed to spawn sub-process: ${templateName}`, e);
      }
    }
  }

  return {
    init() {},
    dispose() {},
    tick() {
      const seedEaters = world.query(CorruptionState, Position);
      for (const id of seedEaters) {
        const state = world.getComponent(id, CorruptionState)!;
        
        spreadCorruption(id);
        
        state.turnsSinceLastSpawn++;
        if (state.turnsSinceLastSpawn >= state.spawnFrequency) {
          spawnSubProcess(id);
          state.turnsSinceLastSpawn = 0;
        }
      }
    }
  };
}

export type TileCorruptionSystem = ReturnType<typeof createTileCorruptionSystem>;
