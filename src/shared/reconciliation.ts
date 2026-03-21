import { applyChangeset } from 'json-diff-ts';
import { World } from '../engine/ecs/world';
import { Grid } from '../engine/grid/grid';
import { EventBus } from '../engine/events/event-bus';
import { serializeWorld, serializeGrid, deserializeWorld, deserializeGrid } from './serialization';
import { StateDelta } from './types';

/**
 * Applies a StateDelta to a World and Grid instance and emits relevant events.
 */
export function applyStateDelta(
  world: World,
  grid: Grid,
  eventBus: EventBus<any>,
  delta: StateDelta,
  baseWorldState?: any,
  baseGridState?: any
): void {
  // 1. Get base states (either provided or current)
  const currentWorldState = baseWorldState || serializeWorld(world);
  const currentGridState = baseGridState || serializeGrid(grid);

  // 2. Patch snapshots with server delta
  const patchedWorld = applyChangeset(currentWorldState, delta.world);
  const patchedGrid = applyChangeset(currentGridState, delta.grid);

  // 3. Load patched state back into engine instances
  world.loadSerializableState(patchedWorld);
  grid.loadSerializableTiles(patchedGrid.tiles);

  // 4. Emit events based on the delta
  // Note: Since world is already updated, we can just walk the diff and emit.
  const worldChanges = delta.world as any[];

  const processChanges = (changes: any[], currentPath: string[]) => {
    for (const change of changes) {
      const path = [...currentPath, ...change.key.split('.')];

      // Entity changes
      if (path[0] === 'entities') {
        if (change.type === 'ADD') {
          eventBus.emit('ENTITY_CREATED', { entityId: change.value });
        } else if (change.type === 'REMOVE') {
          eventBus.emit('ENTITY_DESTROYED', { entityId: change.oldValue });
        }
        continue;
      }

      // Component changes
      if (path[0] === 'stores') {
        const componentKey = path[1];
        const entityIdStr = path[2];
        
        if (!entityIdStr) {
          if (change.changes) processChanges(change.changes, path);
          continue;
        }

        const entityId = Number(entityIdStr);
        if (isNaN(entityId)) {
          if (change.changes) processChanges(change.changes, path);
          continue;
        }

        if (change.type === 'ADD' || change.type === 'UPDATE') {
          if (path.length > 3) {
            const property = path[3];
            if (componentKey === 'position') {
              // Get current pos (already updated) and old pos (from change)
              const currentPos = world.getComponent(entityId, { key: 'position' } as any) as any;
              eventBus.emit('ENTITY_MOVED', {
                entityId,
                fromX: property === 'x' ? change.oldValue : currentPos?.x,
                fromY: property === 'y' ? change.oldValue : currentPos?.y,
                toX: currentPos?.x,
                toY: currentPos?.y
              });
            }
          } else if (change.changes) {
            processChanges(change.changes, path);
          } else {
            eventBus.emit('COMPONENT_ADDED', { entityId, componentKey });
          }
        } else if (change.type === 'REMOVE') {
          eventBus.emit('COMPONENT_REMOVED', { entityId, componentKey });
        }
      } else if (change.changes) {
        processChanges(change.changes, path);
      }
    }
  };

  processChanges(worldChanges, []);

  // 5. Grid Events (Items)
  const gridChanges = delta.grid as any[];
  for (const change of gridChanges) {
    const path = change.key.split('.');
    if (path[0] === 'tiles' && path[2] === 'items') {
      // Could emit item events here if needed
    }
  }
}
