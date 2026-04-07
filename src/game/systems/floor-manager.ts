import { World } from '@engine/ecs/world';
import { Grid } from '@engine/grid/grid';
import { EventBus } from '@engine/events/event-bus';
import { EntityId } from '@engine/ecs/types';
import { EntityFactory } from '@engine/entity/factory';
import { ComponentRegistry } from '@engine/entity/types';
import { FloorState, FloorStateData } from '@shared/components/floor-state';
import { Position, PositionData } from '@shared/components/position';
import { GameplayEvents } from '@shared/events/types';
import { GameEvents } from '../events/types';
import { generateDungeon, getDepthBand } from '../generation/dungeon-generator';
import { placeEntities } from '../generation/entity-placement';
import { hashSeedForPlacement } from '../engine-factory';
import RNG from 'rot-js/lib/rng';

/**
 * The FloorManagerSystem orchestrates transitions between floors.
 * It handles destroying entities, regenerating the grid, and re-placing the player.
 */
export function createFloorManagerSystem<T extends GameplayEvents = GameEvents>(
  world: World<T>,
  grid: Grid,
  eventBus: EventBus<T>,
  entityFactory: EntityFactory,
  componentRegistry: ComponentRegistry,
  playerId: EntityId,
  isClient: boolean = false
) {
  /**
   * Transitions the game to a new floor.
   */
  const descendToFloor = (newFloor: number, runSeed: string) => {
    // 1. Snapshot all entity IDs to avoid modification-during-iteration issues
    const entities = [...world.query()];

    // 2. Destroy all non-player entities
    entities.filter(id => id !== playerId).forEach(id => world.destroyEntity(id));

    // 3. Clear the grid
    grid.clear();

    // 4. Generate floor seed and set RNG
    const floorSeed = `${runSeed}_floor_${newFloor}`;
    const hash = hashSeedForPlacement(floorSeed);
    RNG.setSeed(hash);
    const rng = { random: () => RNG.getUniform() };

    // 5. Generate new dungeon layout
    const dungeonResult = generateDungeon({
      width: grid.width,
      height: grid.height,
      seed: floorSeed,
      depth: newFloor
    });

    // 6. Replace grid terrain
    for (let y = 0; y < grid.height; y++) {
      for (let x = 0; x < grid.width; x++) {
        const tile = dungeonResult.grid.getTile(x, y);
        if (tile) {
          grid.setTile(x, y, { 
            terrain: tile.terrain,
            walkable: tile.walkable,
            transparent: tile.transparent
          });
        }
      }
    }

    // 7. Move player to new spawn room
    const spawnX = Math.floor(dungeonResult.playerSpawnRoom.x + dungeonResult.playerSpawnRoom.width / 2);
    const spawnY = Math.floor(dungeonResult.playerSpawnRoom.y + dungeonResult.playerSpawnRoom.height / 2);
    
    const pos = world.getComponent<PositionData>(playerId, Position);
    if (pos) {
      pos.x = spawnX;
      pos.y = spawnY;
    }
    grid.addEntity(playerId, spawnX, spawnY);

    // 8. Place new entities for the floor
    placeEntities(
      world,
      grid,
      entityFactory,
      componentRegistry,
      dungeonResult.rooms,
      dungeonResult.playerSpawnRoom,
      rng,
      { depth: newFloor, skipPlayer: true }
    );

    // 9. Update player FloorState
    const floorState = world.getComponent<FloorStateData>(playerId, FloorState);
    if (floorState) {
      floorState.currentFloor = newFloor;
    }

    // 10. Emit transition event
    const band = getDepthBand(newFloor);
    eventBus.emit('FLOOR_TRANSITION', {
      floorNumber: newFloor,
      depthBand: band ? band.label : 'Unknown'
    });

    // 11. Emit dungeon generated event for renderer/UI refresh
    eventBus.emit('DUNGEON_GENERATED', { seed: floorSeed });

    // 12. Flush event bus to ensure everything is processed (especially while turn manager might be paused)
    eventBus.flush();
  };

  /** Initialize listeners. */
  const init = () => {
    // Only listen for descent triggers on the server
    // On the client, this is handled by receiving the full sync payload
    if (!isClient) {
      eventBus.on('STAIRCASE_DESCEND_TRIGGERED', (payload) => {
        descendToFloor(payload.targetFloor, payload.runSeed);
      });
    }
  };

  return {
    init,
    descendToFloor
  };
}

export type FloorManagerSystem<T extends GameplayEvents = GameEvents> = ReturnType<typeof createFloorManagerSystem<T>>;
