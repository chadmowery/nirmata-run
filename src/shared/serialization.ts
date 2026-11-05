import { World } from '../engine/ecs/world';
import { Grid } from '../engine/grid/grid';
import { EventBus } from '../engine/events/event-bus';
import { EngineEvents } from '../engine/events/types';
import { GameplayEvents } from './events/types';
import { SerializedWorld, SerializedGrid, ECSWorldDelta } from './types';

/**
 * Redacts secret/server-authoritative component fields from a serialized world state
 * before transmitting to untrusted network clients.
 *
 * Anti-cheat protections:
 * - container: deletes storedLoot, scrapYield, fluxYield, grantsAccessKey, blueprintId, blueprintType
 * - corruptedNode: deletes trapType when revealed is false
 */
export function redactWorldForClient(worldData: SerializedWorld): SerializedWorld {
  if (!worldData || !worldData.stores) {
    return worldData;
  }
  const cloned: SerializedWorld = JSON.parse(JSON.stringify(worldData));
  if (!cloned.stores) {
    return cloned;
  }

  // 1. Redact Container secret rolls
  const containerStore = cloned.stores['container'];
  if (containerStore) {
    for (const compData of Object.values(containerStore)) {
      if (compData && typeof compData === 'object') {
        const container = compData as Record<string, unknown>;
        delete container.storedLoot;
        delete container.scrapYield;
        delete container.fluxYield;
        delete container.grantsAccessKey;
        delete container.blueprintId;
        delete container.blueprintType;
      }
    }
  }

  // 2. Redact unrevealed CorruptedNode trap types
  const corruptedStore = cloned.stores['corruptedNode'];
  if (corruptedStore) {
    for (const compData of Object.values(corruptedStore)) {
      if (compData && typeof compData === 'object') {
        const node = compData as Record<string, unknown>;
        if (!node.revealed) {
          delete node.trapType;
        }
      }
    }
  }

  // 3. Redact FloorState authoritative runSeed
  const floorStateStore = cloned.stores['floorState'];
  if (floorStateStore) {
    for (const compData of Object.values(floorStateStore)) {
      if (compData && typeof compData === 'object') {
        const fs = compData as Record<string, unknown>;
        fs.runSeed = 'REDACTED';
      }
    }
  }

  return cloned;
}

/**
 * Redacts secret/server-authoritative component fields from an ECSWorldDelta
 * before transmitting to untrusted network clients.
 */
export function redactDeltaForClient(delta: ECSWorldDelta): ECSWorldDelta {
  if (!delta || !delta.componentsSet) {
    return delta;
  }
  const cloned: ECSWorldDelta = JSON.parse(JSON.stringify(delta));
  if (!cloned.componentsSet) {
    return cloned;
  }

  for (const item of cloned.componentsSet) {
    if (item.component === 'container' && item.data && typeof item.data === 'object') {
      const container = item.data as Record<string, unknown>;
      delete container.storedLoot;
      delete container.scrapYield;
      delete container.fluxYield;
      delete container.grantsAccessKey;
      delete container.blueprintId;
      delete container.blueprintType;
    } else if (item.component === 'corruptedNode' && item.data && typeof item.data === 'object') {
      const node = item.data as Record<string, unknown>;
      if (!node.revealed) {
        delete node.trapType;
      }
    }
  }

  return cloned;
}

/**
 * Serializes the ECS World to a JSON-compatible object.
 * Optionally redacts server-only secrets if redactForClient is true.
 */
export function serializeWorld<T extends EngineEvents>(
  world: World<T>,
  options?: { redactForClient?: boolean },
): SerializedWorld {
  const state = world.getSerializableState();
  // We MUST deep clone to ensure this snapshot is independent
  const serialized = JSON.parse(JSON.stringify(state)) as SerializedWorld;
  if (options?.redactForClient) {
    return redactWorldForClient(serialized);
  }
  return serialized;
}

/**
 * Deserializes a JSON-compatible object into an ECS World instance.
 */
export function deserializeWorld<T extends GameplayEvents>(
  data: SerializedWorld,
  eventBus: EventBus<T>,
): World<T> {
  const world = new World(eventBus as unknown as EventBus<EngineEvents>) as unknown as World<T>;
  world.loadSerializableState(data);
  return world;
}

/**
 * Serializes the Grid to a JSON-compatible object.
 */
export function serializeGrid(grid: Grid): SerializedGrid {
  const state = {
    width: grid.width,
    height: grid.height,
    tiles: grid.getSerializableTiles(),
  };
  return JSON.parse(JSON.stringify(state)) as SerializedGrid;
}

/**
 * Deserializes a JSON-compatible object into a Grid instance.
 */
export function deserializeGrid(data: SerializedGrid): Grid {
  const grid = new Grid(data.width, data.height);
  grid.loadSerializableTiles(data.tiles);
  return grid;
}
