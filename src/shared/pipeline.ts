import { diff } from 'json-diff-ts';
import { World } from '../engine/ecs/world';
import { Grid } from '../engine/grid/grid';
import { EventBus } from '../engine/events/event-bus';
import { GameplayEvents } from './events/types';
import { ActionIntent, StateDelta } from './types';
import { serializeWorld, serializeGrid, deserializeWorld, deserializeGrid } from './serialization';
import { logger } from './utils/logger';

import {
  Position, RunInventory,
  MoveIntent, AttackIntent, VentIntent, COMPONENTS_REGISTRY,
  DescentIntent, ExtractionIntent, EquipIntent, UnequipIntent, Dying, ShellUpdateTag, MovedThisTurn,
  BurnSoftwareIntent, FirmwareIntent
} from './components';
import * as InventoryUtil from './utils/inventory-util';
import { checkAutoLoader } from '../game/systems/software-effects';
import { Phase } from '../engine/ecs/types';
import { EntityRegistry } from '../engine/entity/registry';
import { EntityFactory } from '../engine/entity/factory';
import { ComponentRegistry } from '../engine/entity/types';
import { registerCoreSystems } from '../game/systems/registration';
import { RunMode } from './run-mode';

/**
 * Runs a game action against a world/grid state and returns the new state and delta.
 * This is a pure function (it clones the input state).
 */
export function runActionPipeline(
  world: World<GameplayEvents>,
  grid: Grid,
  playerId: number,
  action: ActionIntent,
  sessionId?: string
): { world: World<GameplayEvents>; grid: Grid; delta: StateDelta } {
  logger.debug(`[PIPELINE] Processing action: ${action.type}`, action);
  // 1. Snapshot initial state
  const oldWorldState = serializeWorld(world);
  const oldGridState = serializeGrid(grid);

  // 2. Clone for processing (using a local event bus to avoid global side effects)
  const localEventBus = new EventBus<GameplayEvents>();
  const newWorld = deserializeWorld(oldWorldState, localEventBus);
  const newGrid = deserializeGrid(oldGridState);

  // 3. Process Action (Attaches Intents)
  processAction(newWorld, newGrid, localEventBus, playerId, action, sessionId);

  // 4. Initialize Core Systems for simulation
  const dummyEntityRegistry = new EntityRegistry();
  const dummyEntityFactory = new EntityFactory(dummyEntityRegistry);
  const dummyComponentRegistry: ComponentRegistry = {
    get: (key: string) => COMPONENTS_REGISTRY.find(c => c.key === key) as any,
    has: (key: string) => COMPONENTS_REGISTRY.some(c => c.key === key),
  };

  registerCoreSystems(
    newWorld,
    newGrid,
    localEventBus,
    dummyEntityFactory,
    dummyComponentRegistry,
    { skipLoot: true, runMode: RunMode.SIMULATION }
  );

  // 5. Execute Core Phases
  newWorld.executeSystems(Phase.PRE_TURN);
  newWorld.executeSystems(Phase.GATHER_INTENT);
  newWorld.executeSystems(Phase.ACTION);
  newWorld.executeSystems(Phase.REACTION);
  newWorld.executeSystems(Phase.CLEANUP);
  newWorld.executeSystems(Phase.POST_TURN);

  localEventBus.flush();

  // 5. Serialize final state
  const newWorldState = serializeWorld(newWorld);
  const newGridState = serializeGrid(newGrid);

  // 6. Calculate Delta
  const delta = {
    world: diff(oldWorldState, newWorldState),
    grid: diff(oldGridState, newGridState),
  };

  return { world: newWorld, grid: newGrid, delta };
}

function processAction(world: World<GameplayEvents>, grid: Grid, eventBus: EventBus<GameplayEvents>, entityId: number, action: ActionIntent, sessionId?: string) {
  switch (action.type) {
    case 'MOVE':
      world.addComponent(entityId, MoveIntent, { dx: action.dx, dy: action.dy });
      break;
    case 'WAIT':
      // Do nothing
      break;
    case 'PICKUP': {
      // Walking onto an item triggers pickup via MovedThisTurn in Phase.REACTION.
      // If called explicitly, we simulate a "move to self" to trigger the system.
      const pos = world.getComponent(entityId, Position);
      if (pos) {
        world.addComponent(entityId, MovedThisTurn, {
          fromX: pos.x,
          fromY: pos.y,
          toX: pos.x,
          toY: pos.y
        });
      }
      break;
    }
    case 'ATTACK':
      // Explicit attack intent
      world.addComponent(entityId, AttackIntent, { targetId: action.targetId });
      break;
    case 'EQUIP':
      world.addComponent(entityId, EquipIntent, { slotType: action.slotType, itemEntityId: action.itemEntityId });
      break;
    case 'UNEQUIP':
      world.addComponent(entityId, UnequipIntent, { slotType: action.slotType, slotIndex: action.slotIndex });
      break;
    case 'BURN_SOFTWARE': {
      const inventory = world.getComponent(entityId, RunInventory);
      const swItem = inventory?.software[action.runInventoryIndex];
      if (swItem) {
        world.addComponent(entityId, BurnSoftwareIntent, {
          actorId: entityId,
          softwareEntityId: swItem.entityId,
          targetSlot: action.targetSlot,
          inventoryIndex: action.runInventoryIndex,
        });
      }
      break;
    }
    case 'SELECT_SHELL':
      world.addComponent(entityId, ShellUpdateTag, {});
      eventBus.emit('SHELL_SELECTED', { shellId: action.shellId });
      break;
    case 'UPGRADE_SHELL':
      world.addComponent(entityId, ShellUpdateTag, {});
      eventBus.emit('SHELL_STATS_CHANGED', { entityId, shellId: action.shellId });
      break;
    case 'USE_FIRMWARE':
      world.addComponent(entityId, FirmwareIntent, {
        actorId: entityId,
        slotIndex: action.slotIndex,
        targetX: action.targetX,
        targetY: action.targetY,
      });
      break;
    case 'VENT':
      world.addComponent(entityId, VentIntent, {});
      break;
    case 'MOVE_AND_USE_FIRMWARE':
      // Only allowed if checkAutoLoader returns true
      if (!checkAutoLoader(world, entityId)) {
        eventBus.emit('MESSAGE_EMITTED', { text: 'Auto-Loader.msi required', type: 'error' });
        break;
      }
      world.addComponent(entityId, MoveIntent, { dx: action.dx, dy: action.dy });
      // Delegate to USE_FIRMWARE handling
      processAction(world, grid, eventBus, entityId, {
        type: 'USE_FIRMWARE',
        slotIndex: action.firmwareSlotIndex,
        targetX: action.targetX,
        targetY: action.targetY,
      });
      break;
    case 'ANCHOR_DESCEND':
      world.addComponent(entityId, DescentIntent, { targetFloor: 0, cost: action.cost }); // Floor manager handles target calculation
      break;
    case 'ANCHOR_EXTRACT':
      world.addComponent(entityId, ExtractionIntent, { reason: 'anchor' });
      break;
    case 'STAIRCASE_DESCEND':
      world.addComponent(entityId, DescentIntent, { targetFloor: action.targetFloor, cost: 0 });
      break;
    case 'PICKUP_CURRENCY': {
      const success = InventoryUtil.addCurrency(world, entityId, action.currencyType, action.amount);
      if (success) {
        // Mark the dropped item as dying instead of destroying immediately
        world.addComponent(action.itemId, Dying, { reason: 'pickup' });
        eventBus.emit('CURRENCY_PICKED_UP', {
          entityId,
          currencyType: action.currencyType,
          amount: action.amount
        });
      }
      break;
    }
  }
}
