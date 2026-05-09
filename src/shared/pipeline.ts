import { diff } from 'json-diff-ts';
import { World } from '../engine/ecs/world';
import { Grid } from '../engine/grid/grid';
import { EventBus } from '../engine/events/event-bus';
import { GameplayEvents } from './events/types';
import { ActionIntent, StateDelta } from './types';
import { serializeWorld, serializeGrid, deserializeWorld, deserializeGrid } from './serialization';
import { logger } from './utils/logger';

import {
  Position, Health, Item, PickupEffect, EffectType,
  SoftwareDef, BurnedSoftware,
  Stability, AnchorMarker, FloorState, RarityTier,
  RunInventory, CurrencyItem, TemplateId,
  MoveIntent, AttackIntent, COMPONENTS_REGISTRY,
} from './components';
import { handleEquip, handleUnequip } from './systems/equipment';
import * as InventoryUtil from './utils/inventory-util';
import { checkAutoLoader } from '../game/systems/software-effects';
import { Phase } from '../engine/ecs/types';
import { EntityRegistry } from '../engine/entity/registry';
import { EntityFactory } from '../engine/entity/factory';
import { ComponentRegistry } from '../engine/entity/types';
import { registerCoreSystems } from '../game/systems/registration';

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
    { skipLoot: true }
  );

  // 5. Execute Core Phases
  newWorld.executeSystems(Phase.ACTION);
  newWorld.executeSystems(Phase.REACTION);

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
    case 'PICKUP':
      // Item pickup is usually triggered by MOVE, but if called explicitly:
      handlePickup(world, grid, eventBus, entityId, action.itemId);
      break;
    case 'ATTACK':
      // Explicit attack intent
      world.addComponent(entityId, AttackIntent, { targetId: action.targetId });
      break;
    case 'EQUIP':
      handleEquip(world, eventBus, entityId, action.slotType, action.itemEntityId);
      break;
    case 'UNEQUIP':
      handleUnequip(world, eventBus, entityId, action.slotType, action.slotIndex);
      break;
    case 'BURN_SOFTWARE': {
      const inventory = world.getComponent(entityId, RunInventory);
      if (!inventory) {
        eventBus.emit('MESSAGE_EMITTED', { text: 'Inventory component not found.', type: 'error' });
        return;
      }
      const swItem = inventory.software[action.runInventoryIndex];
      if (!swItem) {
        eventBus.emit('MESSAGE_EMITTED', { text: 'Invalid software index.', type: 'error' });
        return;
      }

      const swDef = world.getComponent(swItem.entityId, SoftwareDef);
      if (!swDef) {
        eventBus.emit('MESSAGE_EMITTED', { text: 'Software definition not found.', type: 'error' });
        return;
      }

      // 1. Slot check
      if (swDef.targetSlot !== action.targetSlot) {
        eventBus.emit('MESSAGE_EMITTED', {
          text: `Cannot burn ${swDef.name} onto ${action.targetSlot} slot. It requires ${swDef.targetSlot}.`,
          type: 'error'
        });
        return;
      }

      // 2. Duplicate check
      let burned = world.getComponent(entityId, BurnedSoftware);
      if (!burned) {
        const newData = { weapon: null, armor: null };
        world.addComponent(entityId, BurnedSoftware, newData);
        burned = newData;
      }

      const activeSoftwareIds = [burned.weapon, burned.armor].filter((id): id is number => id !== null);
      for (const activeId of activeSoftwareIds) {
        const activeDef = world.getComponent(activeId, SoftwareDef);
        if (activeDef && activeDef.type === swDef.type) {
          eventBus.emit('MESSAGE_EMITTED', {
            text: `Software type ${swDef.type} is already active.`,
            type: 'error'
          });
          return;
        }
      }

      // 3. Overwrite/Burn
      const oldSoftwareId = burned[action.targetSlot];
      if (oldSoftwareId !== null) {
        world.destroyEntity(oldSoftwareId);
      }

      world.patchComponent(entityId, BurnedSoftware, {
        [action.targetSlot]: swItem.entityId
      });
      InventoryUtil.removeSoftware(world, entityId, action.runInventoryIndex);

      eventBus.emit('SOFTWARE_BURNED', {
        entityId,
        softwareId: swItem.entityId,
        targetSlot: action.targetSlot
      });

      eventBus.emit('MESSAGE_EMITTED', {
        text: `Successfully burned ${swDef.name} onto ${action.targetSlot}.`,
        type: 'combat'
      });
      break;
    }
    case 'SELECT_SHELL':
      // Placeholder for Phase 7: emitting event is enough for now, 
      // actual stat stamping happens in engine-factory or special system
      eventBus.emit('SHELL_SELECTED', { shellId: action.shellId });
      break;
    case 'UPGRADE_SHELL':
      // Will be handled by ShellStatsSystem listening to event
      eventBus.emit('SHELL_STATS_CHANGED', { entityId, shellId: action.shellId });
      break;
    case 'USE_FIRMWARE':
      // For now, emit intent. Full resolution in Phase 13 or specific system.
      // This allows MOVE_AND_USE_FIRMWARE to at least emit the intent.
      eventBus.emit('PLAYER_ACTION', { action: 'USE_FIRMWARE', entityId });
      break;
    case 'VENT':
      eventBus.emit('PLAYER_ACTION', { action: 'VENT', entityId });
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
    case 'ANCHOR_DESCEND': {
      const currentScrap = InventoryUtil.getCurrencyAmount(world, entityId, 'scrap');
      if (currentScrap < action.cost) {
        eventBus.emit('MESSAGE_EMITTED', {
          text: `INSUFFICIENT_SCRAP: ${action.cost} REQUIRED`,
          type: 'error'
        });
        return;
      }
      InventoryUtil.removeCurrency(world, entityId, 'scrap', action.cost);
      const stability = world.getComponent(entityId, Stability);
      if (stability) {
        const oldValue = stability.current;
        const newValue = Math.min(stability.max, stability.current + stability.max * 0.5);
        world.patchComponent(entityId, Stability, { current: newValue });
        eventBus.emit('STABILITY_CHANGED', {
          entityId,
          oldValue,
          newValue,
          reason: 'anchor_refill'
        });
      }
      const anchorMarker = world.getComponent(action.anchorId, AnchorMarker);
      if (anchorMarker) {
        world.patchComponent(action.anchorId, AnchorMarker, { used: true });
      }
      eventBus.emit('MESSAGE_EMITTED', {
        text: `STABILIZE_AND_DESCEND: -${action.cost} Scrap, Stability refilled`,
        type: 'info'
      });
      break;
    }
    case 'ANCHOR_EXTRACT':
      eventBus.emit('ANCHOR_EXTRACT', {});
      break;
    case 'PICKUP_CURRENCY': {
      // Explicit pickup for prediction/authoritative sync
      const success = InventoryUtil.addCurrency(world, entityId, action.currencyType, action.amount);
      if (success) {
        grid.removeItem(action.itemId, 0, 0); // Simplified, item-pickup handles actual grid removal
        world.destroyEntity(action.itemId);
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

function handlePickup(world: World<GameplayEvents>, grid: Grid, eventBus: EventBus<GameplayEvents>, entityId: number, itemId: number) {
  if (!world.hasComponent(itemId, Item)) return;

  const effect = world.getComponent(itemId, PickupEffect);
  if (effect && effect.type === EffectType.HEAL) {
    const health = world.getComponent(entityId, Health);
    if (health) {
      world.patchComponent(entityId, Health, {
        current: Math.min(health.max, health.current + effect.value)
      });
    }
  }

  // Handle CurrencyItem pickup
  const currencyItem = world.getComponent(itemId, CurrencyItem);
  if (currencyItem) {
    InventoryUtil.addCurrency(world, entityId, currencyItem.currencyType, currencyItem.amount, {
      blueprintId: currencyItem.blueprintId,
      blueprintType: currencyItem.blueprintType
    });
  }

  // Handle Software item pickup
  const swDef = world.getComponent(itemId, SoftwareDef);
  if (swDef) {
    const rarity = world.getComponent(itemId, RarityTier);
    const templateRef = world.getComponent(itemId, TemplateId);
    const floorState = world.getComponent(entityId, FloorState);

    if (templateRef) {
      const added = InventoryUtil.addSoftware(world, entityId, {
        entityId: itemId,
        templateId: templateRef.id,
        rarityTier: rarity?.tier || 'v1.x',
        pickedUpAtFloor: floorState?.currentFloor || 1,
        pickedUpAtTimestamp: Date.now(),
      });

      if (added) {
        eventBus.emit('MESSAGE_EMITTED', {
          text: `+ SOFTWARE SECURED: ${swDef.name} [${rarity?.tier || 'v1.x'}]`,
          type: 'info'
        });

        const pos = world.getComponent(entityId, Position);
        if (pos) {
          grid.removeItem(itemId, pos.x, pos.y);
        }
        // NOTE: We DO NOT destroy the entity here because it's now in the inventory.
        // It will be destroyed if burned or when the run ends.
        eventBus.emit('ITEM_PICKED_UP', { entityId, itemId });
        return;
      } else {
        eventBus.emit('MESSAGE_EMITTED', {
          text: `INVENTORY FULL: Cannot secure ${swDef.name}`,
          type: 'error'
        });
      }
    }
  }

  const pos = world.getComponent(entityId, Position);
  if (pos) {
    grid.removeItem(itemId, pos.x, pos.y);
  }
  world.destroyEntity(itemId);
  eventBus.emit('ITEM_PICKED_UP', { entityId, itemId });
}

// handlePickup is still used for explicit PICKUP intent or auto-pickup logic in other phases
// handleDeath and setupInternalHandlers have been collapsed into authoritative systems
