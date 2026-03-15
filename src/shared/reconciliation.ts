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
  delta: StateDelta
): void {
  const worldChanges = delta.world as any[];

  // Helper to walk the diff tree and emit events
  const processChanges = (changes: any[], currentPath: string[]) => {
    for (const change of changes) {
      const path = [...currentPath, ...change.key.split('.')];

      // Entity changes
      if (path[0] === 'entities') {
        if (change.type === 'ADD') {
          const entityId = change.value;
          if (!world.entityExists(entityId)) {
            (world as any).entities.add(entityId);
            eventBus.emit('ENTITY_CREATED', { entityId });
          }
        } else if (change.type === 'REMOVE') {
          world.destroyEntity(change.oldValue);
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
            const currentData = world.getComponent(entityId, { key: componentKey } as any);
            if (currentData) {
              (currentData as any)[property] = change.value;

              if (componentKey === 'position') {
                eventBus.emit('ENTITY_MOVED', {
                  entityId,
                  fromX: property === 'x' ? change.oldValue : currentData.x,
                  fromY: property === 'y' ? change.oldValue : currentData.y,
                  toX: currentData.x,
                  toY: currentData.y
                });
              }
            }
          } else if (change.changes) {
            // Nested changes (RECURSION)
            processChanges(change.changes, path);
          } else {
            // Full component replacement
            world.addComponent(entityId, { key: componentKey } as any, change.value);
          }
        } else if (change.type === 'REMOVE') {
          world.removeComponent(entityId, { key: componentKey } as any);
        }
      } else if (change.changes) {
        processChanges(change.changes, path);
      }
    }
  };

  // 1. Process World Changes
  processChanges(worldChanges, []);

  // 2. Process Grid Changes (Items)
  const gridChanges = delta.grid as any[];
  for (const change of gridChanges) {
    const path = change.key.split('.');
    if (path[0] === 'tiles' && path[2] === 'items') {
      // Item changes at a specific tile
      // This is harder to map to events without knowing the coordinates.
      // For now, let's rely on the fact that world.destroyEntity(itemId) already happened.
    }
  }

  // 3. Final snap to ensure everything is perfect (handles nested changes we might have missed)
  const worldState = serializeWorld(world);
  const gridState = serializeGrid(grid);
  const patchedWorld = applyChangeset(worldState, delta.world);
  const patchedGrid = applyChangeset(gridState, delta.grid);

  world.loadSerializableState(patchedWorld);
  grid.loadSerializableTiles(patchedGrid.tiles);
}
