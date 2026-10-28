import { SerializedWorld, ECSWorldDelta } from './types';

/**
 * Computes a fine-grained, component-level delta between two serialized ECS World states.
 * This replaces transmitting the entire multi-kilobyte world JSON on every single turn.
 */
export function createECSWorldDelta(
  oldWorld: SerializedWorld,
  newWorld: SerializedWorld,
): ECSWorldDelta {
  const oldEntitiesSet = new Set(oldWorld.entities);
  const newEntitiesSet = new Set(newWorld.entities);

  const entitiesAdded: number[] = [];
  const entitiesRemoved: number[] = [];

  for (const id of newWorld.entities) {
    if (!oldEntitiesSet.has(id)) {
      entitiesAdded.push(id);
    }
  }

  for (const id of oldWorld.entities) {
    if (!newEntitiesSet.has(id)) {
      entitiesRemoved.push(id);
    }
  }

  const componentsSet: ECSWorldDelta['componentsSet'] = [];
  const componentsRemoved: ECSWorldDelta['componentsRemoved'] = [];

  // 1. Detect updated or added components
  for (const [componentKey, newStore] of Object.entries(newWorld.stores)) {
    const oldStore = oldWorld.stores[componentKey];

    for (const [entityIdStr, newData] of Object.entries(newStore)) {
      const entityId = Number(entityIdStr);

      if (!oldStore || !(entityIdStr in oldStore)) {
        // New component on entity
        componentsSet.push({ component: componentKey, entityId, data: newData });
      } else {
        const oldData = oldStore[entityIdStr];
        // Compare values
        if (JSON.stringify(oldData) !== JSON.stringify(newData)) {
          componentsSet.push({ component: componentKey, entityId, data: newData });
        }
      }
    }
  }

  // 2. Detect removed components (for entities that are still alive)
  const removedEntitySet = new Set(entitiesRemoved);
  for (const [componentKey, oldStore] of Object.entries(oldWorld.stores)) {
    const newStore = newWorld.stores[componentKey];

    for (const entityIdStr of Object.keys(oldStore)) {
      const entityId = Number(entityIdStr);
      if (removedEntitySet.has(entityId)) {
        // Entity itself was deleted; no need for individual component removal
        continue;
      }

      if (!newStore || !(entityIdStr in newStore)) {
        componentsRemoved.push({ component: componentKey, entityId });
      }
    }
  }

  return {
    nextId: newWorld.nextId,
    entitiesAdded,
    entitiesRemoved,
    componentsSet,
    componentsRemoved,
  };
}
