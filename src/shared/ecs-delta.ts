import { SerializedWorld, ECSWorldDelta } from './types';
import { redactWorldForClient } from './serialization';

/**
 * Computes a fine-grained, component-level delta between two serialized ECS World states.
 * This replaces transmitting the entire multi-kilobyte world JSON on every single turn.
 * Optionally redacts secret/server-authoritative component fields if redactForClient is true.
 */
export function createECSWorldDelta(
  oldWorld: SerializedWorld,
  newWorld: SerializedWorld,
  options?: { redactForClient?: boolean; visibleEntityIds?: Set<number> | number[] },
): ECSWorldDelta {
  const sourceOld = options?.redactForClient
    ? redactWorldForClient(oldWorld, { visibleEntityIds: options.visibleEntityIds })
    : oldWorld;
  const sourceNew = options?.redactForClient
    ? redactWorldForClient(newWorld, { visibleEntityIds: options.visibleEntityIds })
    : newWorld;

  const oldEntitiesSet = new Set(sourceOld.entities);
  const newEntitiesSet = new Set(sourceNew.entities);

  const entitiesAdded: number[] = [];
  const entitiesRemoved: number[] = [];

  for (const id of sourceNew.entities) {
    if (!oldEntitiesSet.has(id)) {
      entitiesAdded.push(id);
    }
  }

  for (const id of sourceOld.entities) {
    if (!newEntitiesSet.has(id)) {
      entitiesRemoved.push(id);
    }
  }

  const componentsSet: ECSWorldDelta['componentsSet'] = [];
  const componentsRemoved: ECSWorldDelta['componentsRemoved'] = [];

  // 1. Detect updated or added components
  for (const [componentKey, newStore] of Object.entries(sourceNew.stores)) {
    const oldStore = sourceOld.stores[componentKey];

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
  for (const [componentKey, oldStore] of Object.entries(sourceOld.stores)) {
    const newStore = sourceNew.stores[componentKey];

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
    nextId: sourceNew.nextId,
    entitiesAdded,
    entitiesRemoved,
    componentsSet,
    componentsRemoved,
  };
}
