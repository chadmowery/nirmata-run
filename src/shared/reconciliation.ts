import { applyChangeset } from 'json-diff-ts';
import { World } from '../engine/ecs/world';
import { Grid } from '../engine/grid/grid';
import { EventBus } from '../engine/events/event-bus';
import { serializeWorld } from './serialization';
import { StateDelta } from './types';
import { diff } from 'json-diff-ts';

/**
 * Applies a StateDelta to a World and Grid instance and emits relevant events.
 */
export function applyStateDelta(
  world: World,
  grid: Grid,
  eventBus: EventBus<any>,
  delta: StateDelta,
  baseWorldState?: any
): void {
  // 1. Get base states (either provided or current)
  const currentWorldState = baseWorldState || serializeWorld(world);

  // 2. Capture the PREDICTED state (what the client has right now)
  const predictedWorldState = serializeWorld(world);

  // 3. Patch snapshots with server delta to get the TRUTH
  const patchedWorld = applyChangeset(currentWorldState, delta.world);
  
  // NOTE: We do not patch the Grid. Terrain is static, and entities/items
  // are explicitly rebuilt from patchedWorld to avoid json-diff-ts array corruption.

  // 3.5 Compare entities explicitly to avoid json-diff array issues
  const oldEntities = new Set(currentWorldState.entities as number[]);
  const newEntities = new Set(patchedWorld.entities as number[]);

  for (const id of newEntities) {
    if (!oldEntities.has(id)) {
      eventBus.emit('ENTITY_CREATED', { entityId: id });
    }
  }
  
  for (const id of oldEntities) {
    if (!newEntities.has(id)) {
      eventBus.emit('ENTITY_DESTROYED', { entityId: id });
    }
  }

  // 4. Calculate misprediction diff (Predicted -> Server Truth)
  const mispredictionDelta = diff(predictedWorldState, patchedWorld);

  // 5. Load patched state back into engine instances
  world.loadSerializableState(patchedWorld);

  // 5.5 Rebuild Grid Entities to prevent array-patching corruption from json-diff-ts
  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      const tile = grid.getTile(x, y);
      if (tile) {
        tile.entities.clear();
        tile.items.clear();
      }
    }
  }
  
  if (patchedWorld.stores && patchedWorld.stores.position) {
    const itemStore = patchedWorld.stores.item || {};
    for (const [idStr, pos] of Object.entries(patchedWorld.stores.position as Record<string, any>)) {
      const id = Number(idStr);
      if (!isNaN(id) && pos && typeof pos.x === 'number' && typeof pos.y === 'number') {
        if (itemStore[idStr]) {
          grid.addItem(id, pos.x, pos.y);
        } else {
          grid.addEntity(id, pos.x, pos.y);
        }
      }
    }
  }

  // 6. Emit events based on the server delta or misprediction
  // For Movement: Only emit if there was a misprediction (predicted != server)
  // For other things (Combat, Items): Always emit if present in server delta (since we don't predict them yet)
  
  const processChanges = (changes: any[], currentPath: string[], isMisprediction: boolean) => {
    for (const change of changes) {
      const path = [...currentPath, ...change.key.split('.')];

      // Entity changes
      if (path[0] === 'entities') {
        // Handled explicitly above using Set comparisons to avoid array diffing bugs
        continue;
      }

      // Component changes
      if (path[0] === 'stores') {
        const componentKey = path[1];
        const entityIdStr = path[2];
        
        if (!entityIdStr) {
          if (change.changes) processChanges(change.changes, path, isMisprediction);
          continue;
        }

        const entityId = Number(entityIdStr);
        if (isNaN(entityId)) {
          if (change.changes) processChanges(change.changes, path, isMisprediction);
          continue;
        }

        if (change.type === 'ADD' || change.type === 'UPDATE') {
          if (path.length > 3) {
            const property = path[3];
            if (componentKey === 'position') {
              // Only emit ENTITY_MOVED if this is part of a misprediction reconciliation
              if (isMisprediction) {
                const currentPos = world.getComponent(entityId, { key: 'position' } as any) as any;

                eventBus.emit('ENTITY_MOVED', {
                  entityId,
                  fromX: property === 'x' ? change.oldValue : currentPos?.x,
                  fromY: property === 'y' ? change.oldValue : currentPos?.y,
                  toX: currentPos?.x,
                  toY: currentPos?.y
                });
              }
            }
          } else if (change.changes) {
            processChanges(change.changes, path, isMisprediction);
          } else {
            eventBus.emit('COMPONENT_ADDED', { entityId, componentKey });
          }
        } else if (change.type === 'REMOVE') {
          eventBus.emit('COMPONENT_REMOVED', { entityId, componentKey });
        }
      } else if (change.changes) {
        processChanges(change.changes, path, isMisprediction);
      }
    }
  };

  // Process server delta for generic events (non-movement)
  processChanges(delta.world as any[], [], false);
  
  // Process misprediction delta for movement correction
  processChanges(mispredictionDelta as any[], [], true);
}
