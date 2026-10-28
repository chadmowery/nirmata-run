import { applyChangeset } from 'json-diff-ts';
import { World } from '../engine/ecs/world';
import { FloorState } from './components/floor-state';
import { Grid } from '../engine/grid/grid';
import { TurnManager } from '../engine/turn/turn-manager';
import { EventBus } from '../engine/events/event-bus';
import { GameplayEvents } from './events/types';
import { serializeGrid } from './serialization';
import { SyncPayload, DeltaPayload, SerializedGrid } from './types';
import { EventOriginContext } from '@engine/utils/event-context';

/**
 * Reconciles the local client engine state with the authoritative server state.
 * Uses the 'Full Authority' model for the ECS World and 'Delta' model for the Grid.
 */
export function applyStateDelta<T extends GameplayEvents>(
  world: World<T>,
  grid: Grid,
  turnManager: TurnManager<T>,
  eventBus: EventBus<T>,
  payload: SyncPayload,
): number {
  // Set context to server for incoming truth events
  const previousOrigin = EventOriginContext.current;
  EventOriginContext.current = 'server';

  // 1. Authoritative World Update
  if (payload.type === 'FULL') {
    world.loadSerializableState(payload.world);
  } else if ((payload as DeltaPayload).worldDelta) {
    world.applyDelta((payload as DeltaPayload).worldDelta!);
  } else if ((payload as DeltaPayload).world) {
    world.loadSerializableState((payload as DeltaPayload).world!);
  }

  // 2. Authoritative Grid Update
  if (payload.type === 'FULL') {
    grid.loadSerializableTiles(payload.grid.tiles);

    // Emit DUNGEON_GENERATED to clear old sprites and reset camera
    const floorState = world.getComponent(payload.playerId, FloorState);
    const floorSeed = floorState
      ? `${floorState.runSeed}_floor_${floorState.currentFloor}`
      : 'reconciled-seed';
    (eventBus as unknown as EventBus<GameplayEvents>).emit('DUNGEON_GENERATED', {
      seed: floorSeed,
    });
  } else {
    // Grid still uses incremental diffs as it is a stable 1D array of primitives
    const currentGrid = serializeGrid(grid);
    const patchedGrid = applyChangeset(
      currentGrid,
      (payload as DeltaPayload).grid,
    ) as SerializedGrid;
    grid.loadSerializableTiles(patchedGrid.tiles);
  }

  // 3. Authoritative Turn Manager Update
  const phase = payload.type === 'FULL' ? payload.phase : turnManager.getPhase();
  turnManager.loadState(payload.turnNumber, phase);

  // 4. Replay server-side events for visual systems (Animations, UI, Particles)
  if (payload.events) {
    for (const event of payload.events) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      eventBus.emit(event.type as any, event.payload as any);
    }
  }

  // 5. Finalize turn reconciliation
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (eventBus as any).emit('STATE_RECONCILED', {
    turnNumber: payload.turnNumber,
    playerId: payload.playerId,
  });
  eventBus.flush();
  EventOriginContext.current = previousOrigin;

  return payload.playerId;
}
