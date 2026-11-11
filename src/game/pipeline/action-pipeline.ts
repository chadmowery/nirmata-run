import { diff } from 'json-diff-ts';
import { World } from '@engine/ecs/world';
import { Grid } from '@engine/grid/grid';
import { EventBus } from '@engine/events/event-bus';
import { GameplayEvents } from '@shared/events/types';
import { ActionIntent, StateDelta } from '@shared/types';
import { serializeWorld, serializeGrid, deserializeWorld, deserializeGrid } from '@shared/serialization';
import { logger } from '@engine/utils/logger';

import {
  Position,
  RunInventory,
  MoveIntent,
  AttackIntent,
  VentIntent,
  COMPONENTS_REGISTRY,
  DescentIntent,
  ExtractionIntent,
  EquipIntent,
  UnequipIntent,
  ShellUpdateTag,
  BurnSoftwareIntent,
  FirmwareIntent,
  PickupIntent,
  DropItemIntent,
  InteractPropIntent,
  FloorState,
  EquipmentSlots,
  Children,
  SoftwareDef,
  FirmwareSlots,
  AugmentSlots,
  AugmentData,
  AbilityDef,
  Dying,
  ApplyStatusEffectIntent,
  Stability,
  PortConfig,
} from '@shared/components';
import * as InventoryUtil from '@shared/utils/inventory-util';
import { DIRECTIONS, GameAction } from '../input/actions';
import { handleInventorySwap } from '../intent/inventory-intent';
import { handleServerDebugCommand } from '@server/debug/server-debug-handler';
import { checkAutoLoader } from '../systems/software-effects';
import { isItemLike } from '../systems/item-pickup';
import { addHealIntent } from '../systems/combat';
import { Phase, ComponentDef } from '@engine/ecs/types';
import { EntityRegistry } from '@engine/entity/registry';
import { EntityFactory } from '@engine/entity/factory';
import { ComponentRegistry } from '@engine/entity/types';
import { registerCoreSystems } from '../systems/registration';
import { registerGameTemplates } from '../entities';
import { RunMode } from '@shared/run-mode';

export interface ProcessActionOptions {
  sessionId?: string;
  systems?: Record<string, unknown>;
}

/**
 * Runs a game action against a world/grid state and returns the new state and delta.
 * This is a pure function (it clones the input state).
 */
export function runActionPipeline(
  world: World<GameplayEvents>,
  grid: Grid,
  playerId: number,
  action: ActionIntent,
  sessionId?: string,
): { world: World<GameplayEvents>; grid: Grid; delta: StateDelta } {
  void sessionId;
  logger.debug(`[PIPELINE] Processing action: ${action.type}`, 'PIPELINE', action);
  // 1. Snapshot initial state
  const oldWorldState = serializeWorld(world);
  const oldGridState = serializeGrid(grid);

  // 2. Clone for processing (using a local event bus to avoid global side effects)
  const localEventBus = new EventBus<GameplayEvents>();
  const newWorld = deserializeWorld(oldWorldState, localEventBus);
  const newGrid = deserializeGrid(oldGridState);

  // 3. Process Action (Attaches Intents)
  processAction(newWorld, newGrid, localEventBus, playerId, action);

  // 4. Initialize Core Systems for simulation
  const dummyEntityRegistry = new EntityRegistry();
  registerGameTemplates(dummyEntityRegistry);
  const dummyEntityFactory = new EntityFactory(dummyEntityRegistry);
  const dummyComponentRegistry: ComponentRegistry = {
    get: (key: string) =>
      COMPONENTS_REGISTRY.find((c) => c.key === key) as ComponentDef<unknown> | undefined,
    has: (key: string) => COMPONENTS_REGISTRY.some((c) => c.key === key),
  };

  registerCoreSystems(
    newWorld,
    newGrid,
    localEventBus,
    dummyEntityFactory,
    dummyComponentRegistry,
    { skipLoot: true, runMode: RunMode.SIMULATION },
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

/**
 * Validates action parameters, attaches corresponding Intent components to the entity,
 * and returns the TurnManager action key (or null if non-turn action).
 * Shared canonically between the API route and the offline action simulation pipeline.
 */
export function processAction(
  world: World<GameplayEvents>,
  grid: Grid,
  eventBus: EventBus<GameplayEvents>,
  entityId: number,
  action: ActionIntent,
  options?: ProcessActionOptions,
): string | null {
  if (!world.entityExists(entityId) || world.hasComponent(entityId, Dying)) {
    logger.warn(
      `Cannot process action "${action.type}" for non-existent or dying entity: ${entityId}`,
      'PIPELINE',
    );
    return null;
  }

  switch (action.type) {
    case 'MOVE': {
      world.addComponent(entityId, MoveIntent, { dx: action.dx, dy: action.dy });
      for (const [key, dir] of Object.entries(DIRECTIONS)) {
        const d = dir as { dx: number; dy: number };
        if (d.dx === action.dx && d.dy === action.dy) {
          return key;
        }
      }
      return null;
    }
    case 'WAIT':
      return GameAction.WAIT;
    case 'ATTACK':
      world.addComponent(entityId, AttackIntent, { targetId: action.targetId });
      return 'ATTACK';
    case 'PICKUP': {
      if (action.itemId !== undefined) {
        const actorPos = world.getComponent(entityId, Position);
        if (!actorPos) return null;

        if (
          !world.entityExists(action.itemId) ||
          !isItemLike(world, action.itemId) ||
          world.hasComponent(action.itemId, Dying)
        ) {
          eventBus.emit('MESSAGE_EMITTED', {
            text: 'Cannot pick up: item does not exist or was removed.',
            type: 'error',
          });
          return null;
        }

        // Prevent duplicating already-owned or equipped items via spoofed coordinates
        const inv = world.getComponent(entityId, RunInventory);
        const eqSlots = world.getComponent(entityId, EquipmentSlots);
        const fwSlots = world.getComponent(entityId, FirmwareSlots);
        const agSlots = world.getComponent(entityId, AugmentSlots);
        const alreadyOwned =
          inv?.software.some((s) => s.entityId === action.itemId) ||
          inv?.equipment.some((e) => e.entityId === action.itemId) ||
          eqSlots?.weapon === action.itemId ||
          eqSlots?.armor === action.itemId ||
          fwSlots?.equipped.includes(action.itemId) ||
          agSlots?.equipped.includes(action.itemId);
        if (alreadyOwned) {
          eventBus.emit('MESSAGE_EMITTED', {
            text: 'Cannot pick up: item is already in inventory or equipped.',
            type: 'error',
          });
          return null;
        }

        const itemPos = world.getComponent(action.itemId, Position);
        let targetX: number | undefined = itemPos?.x;
        let targetY: number | undefined = itemPos?.y;

        if (targetX === undefined || targetY === undefined) {
          if (
            action.targetX !== undefined &&
            action.targetY !== undefined &&
            grid.getItemsAt(action.targetX, action.targetY).has(action.itemId)
          ) {
            targetX = action.targetX;
            targetY = action.targetY;
          } else {
            for (let dx = -1; dx <= 1; dx++) {
              for (let dy = -1; dy <= 1; dy++) {
                if (
                  Math.abs(dx) + Math.abs(dy) <= 1 &&
                  grid.getItemsAt(actorPos.x + dx, actorPos.y + dy).has(action.itemId)
                ) {
                  targetX = actorPos.x + dx;
                  targetY = actorPos.y + dy;
                  break;
                }
              }
              if (targetX !== undefined) break;
            }
          }
        }

        if (targetX === undefined || targetY === undefined) {
          eventBus.emit('MESSAGE_EMITTED', {
            text: 'Cannot pick up: item location is unknown.',
            type: 'error',
          });
          return null;
        }

        const dist = Math.abs(targetX - actorPos.x) + Math.abs(targetY - actorPos.y);
        if (dist > 1) {
          eventBus.emit('MESSAGE_EMITTED', {
            text: 'Cannot pick up: item is out of reach.',
            type: 'error',
          });
          return null;
        }

        world.addComponent(entityId, PickupIntent, {
          actorId: entityId,
          itemId: action.itemId,
          targetX,
          targetY,
        });
      } else {
        const pos = world.getComponent(entityId, Position);
        if (pos) {
          const itemsOnTile = Array.from(grid.getItemsAt(pos.x, pos.y));
          if (itemsOnTile.length > 0) {
            world.addComponent(entityId, PickupIntent, {
              actorId: entityId,
              itemId: itemsOnTile[0],
              targetX: pos.x,
              targetY: pos.y,
            });
          }
        }
      }
      return 'PICKUP';
    }
    case 'EQUIP':
      world.addComponent(entityId, EquipIntent, {
        slotType: action.slotType,
        itemEntityId: action.itemEntityId,
      });
      return 'EQUIP';
    case 'UNEQUIP':
      world.addComponent(entityId, UnequipIntent, {
        slotType: action.slotType,
        slotIndex: action.slotIndex,
      });
      return 'UNEQUIP';
    case 'SELECT_SHELL':
      world.addComponent(entityId, ShellUpdateTag, {});
      eventBus.emit('SHELL_SELECTED', { shellId: action.shellId });
      return 'SELECT_SHELL';
    case 'UPGRADE_SHELL':
      world.addComponent(entityId, ShellUpdateTag, {});
      eventBus.emit('SHELL_STATS_CHANGED', { entityId, shellId: action.shellId });
      return 'UPGRADE_SHELL';
    case 'USE_FIRMWARE':
      world.addComponent(entityId, FirmwareIntent, {
        actorId: entityId,
        slotIndex: action.slotIndex,
        targetX: action.targetX,
        targetY: action.targetY,
      });
      return `USE_FIRMWARE_${action.slotIndex}:${action.targetX}:${action.targetY}`;
    case 'VENT':
      world.addComponent(entityId, VentIntent, {});
      return GameAction.VENT;
    case 'MOVE_AND_USE_FIRMWARE':
      if (!checkAutoLoader(world, entityId)) {
        eventBus.emit('MESSAGE_EMITTED', { text: 'Auto-Loader.msi required', type: 'error' });
        return null;
      }
      world.addComponent(entityId, MoveIntent, { dx: action.dx, dy: action.dy });
      return processAction(
        world,
        grid,
        eventBus,
        entityId,
        {
          type: 'USE_FIRMWARE',
          slotIndex: action.firmwareSlotIndex,
          targetX: action.targetX,
          targetY: action.targetY,
        },
        options,
      );
    case 'ANCHOR_DESCEND': {
      const floorState = world.getComponent(entityId, FloorState);
      const targetFloor = (floorState?.currentFloor ?? 1) + 1;
      world.addComponent(entityId, DescentIntent, { targetFloor, cost: action.cost });
      return 'ANCHOR_DESCEND';
    }
    case 'ANCHOR_EXTRACT':
      world.addComponent(entityId, ExtractionIntent, { reason: 'manual' });
      return 'ANCHOR_EXTRACT';
    case 'STAIRCASE_DESCEND':
      world.addComponent(entityId, DescentIntent, { targetFloor: action.targetFloor, cost: 0 });
      return 'STAIRCASE_DESCEND';
    case 'PICKUP_CURRENCY': {
      const actorPos = world.getComponent(entityId, Position);
      if (!actorPos) return null;

      if (!world.entityExists(action.itemId) || world.hasComponent(action.itemId, Dying)) {
        eventBus.emit('MESSAGE_EMITTED', {
          text: 'Cannot pick up currency: entity does not exist.',
          type: 'error',
        });
        return null;
      }

      const itemPos = world.getComponent(action.itemId, Position);
      let targetX = itemPos?.x;
      let targetY = itemPos?.y;

      if (targetX === undefined || targetY === undefined) {
        for (let dx = -1; dx <= 1; dx++) {
          for (let dy = -1; dy <= 1; dy++) {
            if (
              Math.abs(dx) + Math.abs(dy) <= 1 &&
              grid.getItemsAt(actorPos.x + dx, actorPos.y + dy).has(action.itemId)
            ) {
              targetX = actorPos.x + dx;
              targetY = actorPos.y + dy;
              break;
            }
          }
          if (targetX !== undefined) break;
        }
      }

      if (targetX === undefined || targetY === undefined) {
        eventBus.emit('MESSAGE_EMITTED', {
          text: 'Cannot pick up currency: location unknown.',
          type: 'error',
        });
        return null;
      }

      const dist = Math.abs(targetX - actorPos.x) + Math.abs(targetY - actorPos.y);
      if (dist > 1) {
        eventBus.emit('MESSAGE_EMITTED', {
          text: 'Cannot pick up currency: out of reach.',
          type: 'error',
        });
        return null;
      }

      world.addComponent(entityId, PickupIntent, {
        actorId: entityId,
        itemId: action.itemId,
        targetX,
        targetY,
      });
      return 'PICKUP_CURRENCY';
    }
    case 'INVENTORY_SWAP':
      handleInventorySwap(world, entityId, action.sourceIndex, action.destinationIndex);
      return 'INVENTORY_SWAP';
    case 'BURN_SOFTWARE': {
      const inventory = world.getComponent(entityId, RunInventory);
      let swEntityId = action.softwareEntityId;
      let foundIdx = action.runInventoryIndex ?? 0;
      let isEquipmentList = false;

      if (swEntityId) {
        const swIdx = inventory?.software.findIndex((s) => s.entityId === swEntityId) ?? -1;
        if (swIdx !== -1) {
          foundIdx = swIdx;
          isEquipmentList = false;
        } else {
          const eqIdx = inventory?.equipment.findIndex((e) => e.entityId === swEntityId) ?? -1;
          if (eqIdx !== -1) {
            foundIdx = eqIdx;
            isEquipmentList = true;
          }
        }
      } else if (inventory?.software[foundIdx]) {
        swEntityId = inventory.software[foundIdx].entityId;
        isEquipmentList = false;
      } else if (inventory?.equipment[foundIdx]) {
        swEntityId = inventory.equipment[foundIdx].entityId;
        isEquipmentList = true;
      }

      if (swEntityId) {
        world.addComponent(entityId, BurnSoftwareIntent, {
          actorId: entityId,
          softwareEntityId: swEntityId,
          targetSlot: action.targetSlot,
          inventoryIndex: foundIdx,
          isEquipmentList,
        });
      }
      return 'BURN_SOFTWARE';
    }
    case 'PURGE_SOFTWARE': {
      const eqSlots = world.getComponent(entityId, EquipmentSlots);
      const targetGearId = eqSlots?.[action.targetSlot];
      if (targetGearId) {
        const children = world.getComponent(targetGearId, Children);
        if (children && children.entityIds.length > 0) {
          for (const childId of children.entityIds) {
            world.addComponent(childId, Dying, { killerId: entityId, reason: 'purged' });
          }
          world.patchComponent(targetGearId, Children, { entityIds: [] });
          eventBus.emit('MESSAGE_EMITTED', {
            text: `Purged software mod from ${action.targetSlot}. Socket cleared.`,
            type: 'info',
          });
        } else if (world.hasComponent(targetGearId, SoftwareDef)) {
          world.addComponent(targetGearId, Dying, { killerId: entityId, reason: 'purged' });
          world.patchComponent(entityId, EquipmentSlots, { [action.targetSlot]: null });
          eventBus.emit('MESSAGE_EMITTED', {
            text: `Purged software mod from ${action.targetSlot}. Socket cleared.`,
            type: 'info',
          });
        }
      }
      return 'PURGE_SOFTWARE';
    }
    case 'BURN_FIRMWARE': {
      // 1. Verify item is in player inventory
      const inv = world.getComponent(entityId, RunInventory);
      const hasItem =
        inv?.software.some((s) => s.entityId === action.firmwareEntityId) ||
        inv?.equipment.some((e) => e.entityId === action.firmwareEntityId);
      if (!hasItem) {
        eventBus.emit('MESSAGE_EMITTED', {
          text: 'Firmware item not found in player inventory.',
          type: 'error',
        });
        return null;
      }

      // 2. Verify item is valid ability definition
      const abilityDef = world.getComponent(action.firmwareEntityId, AbilityDef);
      if (!abilityDef) {
        eventBus.emit('MESSAGE_EMITTED', {
          text: 'Selected item is not a valid firmware subroutine.',
          type: 'error',
        });
        return null;
      }

      // 3. Consult shell port configuration
      const portConfig = world.getComponent(entityId, PortConfig);
      const maxFirmware = portConfig?.maxFirmware ?? 2;
      if (action.slotIndex < 0 || action.slotIndex >= maxFirmware) {
        eventBus.emit('MESSAGE_EMITTED', {
          text: `Cannot burn firmware: slot index ${action.slotIndex + 1} exceeds shell capacity (max ${maxFirmware} ports).`,
          type: 'error',
        });
        return null;
      }

      let fwSlots = world.getComponent(entityId, FirmwareSlots);
      if (!fwSlots) {
        world.addComponent(entityId, FirmwareSlots, { equipped: [] });
        fwSlots = world.getComponent(entityId, FirmwareSlots)!;
      }
      const equipped = [...fwSlots.equipped];

      // If appending a new slot, ensure current equipped slots don't already equal or exceed capacity
      if (action.slotIndex >= equipped.length && equipped.length >= maxFirmware) {
        eventBus.emit('MESSAGE_EMITTED', {
          text: `Cannot burn firmware: all ${maxFirmware} firmware ports are occupied.`,
          type: 'error',
        });
        return null;
      }

      // 4. Remove item from inventory only after capacity and item checks pass
      const consumed = InventoryUtil.removeItemByEntityId(world, entityId, action.firmwareEntityId);
      if (!consumed) {
        eventBus.emit('MESSAGE_EMITTED', {
          text: 'Failed to remove firmware item from inventory.',
          type: 'error',
        });
        return null;
      }

      // 5. Update slots cleanly without placeholder gaps (no 0 entity IDs)
      let installedSlotIndex: number;
      if (action.slotIndex < equipped.length) {
        const oldAbilityId = equipped[action.slotIndex];
        if (oldAbilityId && oldAbilityId !== action.firmwareEntityId) {
          world.addComponent(oldAbilityId, Dying, { killerId: entityId, reason: 'overwritten' });
        }
        equipped[action.slotIndex] = action.firmwareEntityId;
        installedSlotIndex = action.slotIndex;
      } else {
        equipped.push(action.firmwareEntityId);
        installedSlotIndex = equipped.length - 1;
      }
      world.patchComponent(entityId, FirmwareSlots, { equipped });

      eventBus.emit('MESSAGE_EMITTED', {
        text: `+ FIRMWARE BURNED: ${abilityDef?.name || 'Subroutine'} installed in Slot ${installedSlotIndex + 1}`,
        type: 'info',
      });
      return 'BURN_FIRMWARE';
    }
    case 'BURN_AUGMENT': {
      // 1. Verify item is in player inventory
      const inv = world.getComponent(entityId, RunInventory);
      const hasItem =
        inv?.software.some((s) => s.entityId === action.augmentEntityId) ||
        inv?.equipment.some((e) => e.entityId === action.augmentEntityId);
      if (!hasItem) {
        eventBus.emit('MESSAGE_EMITTED', {
          text: 'Augment item not found in player inventory.',
          type: 'error',
        });
        return null;
      }

      // 2. Verify item is valid augment data
      const agData = world.getComponent(action.augmentEntityId, AugmentData);
      if (!agData) {
        eventBus.emit('MESSAGE_EMITTED', {
          text: 'Selected item is not a valid augment module.',
          type: 'error',
        });
        return null;
      }

      // 3. Consult shell port configuration
      const portConfig = world.getComponent(entityId, PortConfig);
      const maxAugment = portConfig?.maxAugment ?? 3;
      if (
        action.slotIndex !== undefined &&
        (action.slotIndex < 0 || action.slotIndex >= maxAugment)
      ) {
        eventBus.emit('MESSAGE_EMITTED', {
          text: `Cannot burn augment: slot index ${action.slotIndex + 1} exceeds shell capacity (max ${maxAugment} ports).`,
          type: 'error',
        });
        return null;
      }

      let agSlots = world.getComponent(entityId, AugmentSlots);
      if (!agSlots) {
        world.addComponent(entityId, AugmentSlots, { equipped: [] });
        agSlots = world.getComponent(entityId, AugmentSlots)!;
      }
      const equipped = [...agSlots.equipped];

      const isExplicitOverwrite =
        action.slotIndex !== undefined && action.slotIndex < equipped.length;
      if (!isExplicitOverwrite && equipped.length >= maxAugment) {
        eventBus.emit('MESSAGE_EMITTED', {
          text: `Cannot burn augment: all ${maxAugment} augment ports are occupied. Specify a slot to overwrite.`,
          type: 'error',
        });
        return null;
      }

      // 4. Remove item from inventory only after capacity and item checks pass
      const consumed = InventoryUtil.removeItemByEntityId(world, entityId, action.augmentEntityId);
      if (!consumed) {
        eventBus.emit('MESSAGE_EMITTED', {
          text: 'Failed to remove augment item from inventory.',
          type: 'error',
        });
        return null;
      }

      // 5. Update slots cleanly without placeholder gaps (no 0 entity IDs)
      let installedSlotIndex: number;
      if (isExplicitOverwrite) {
        const targetSlot = action.slotIndex!;
        const oldAgId = equipped[targetSlot];
        if (oldAgId && oldAgId !== action.augmentEntityId) {
          world.addComponent(oldAgId, Dying, { killerId: entityId, reason: 'overwritten' });
        }
        equipped[targetSlot] = action.augmentEntityId;
        installedSlotIndex = targetSlot;
      } else {
        equipped.push(action.augmentEntityId);
        installedSlotIndex = equipped.length - 1;
      }
      world.patchComponent(entityId, AugmentSlots, { equipped });

      eventBus.emit('MESSAGE_EMITTED', {
        text: `+ AUGMENT BURNED: ${agData?.name || 'Hardware Mod'} integrated into chassis Slot ${installedSlotIndex + 1}`,
        type: 'info',
      });
      return 'BURN_AUGMENT';
    }
    case 'USE_CONSUMABLE': {
      // Validate target: only the player entity itself may be targeted
      if (action.targetEntityId !== undefined && action.targetEntityId !== entityId) {
        eventBus.emit('MESSAGE_EMITTED', {
          text: 'Cannot use consumable on other entities.',
          type: 'error',
        });
        return null;
      }

      const inv = world.getComponent(entityId, RunInventory);
      const itemToUse = inv?.equipment[action.inventoryIndex];
      if (!itemToUse || !itemToUse.isConsumable) {
        eventBus.emit('MESSAGE_EMITTED', {
          text: 'Cannot use item: invalid consumable.',
          type: 'error',
        });
        return null;
      }

      // Direct targeting exclusively to self
      const targetId = entityId;
      const consumed = InventoryUtil.consumeConsumable(world, entityId, action.inventoryIndex);
      if (consumed) {
        addHealIntent(world, entityId, targetId, 5);

        const stability = world.getComponent(targetId, Stability);
        if (stability) {
          const oldValue = stability.current;
          const newValue = Math.min(stability.max, stability.current + 10);
          world.patchComponent(targetId, Stability, { current: newValue });
          eventBus.emit('STABILITY_CHANGED', {
            entityId: targetId,
            oldValue,
            newValue,
            reason: 'consumable_use',
          });
        }

        world.addComponent(entityId, ApplyStatusEffectIntent, {
          targetId,
          effect: {
            name: 'regeneration',
            duration: 3,
            magnitude: 2,
            source: 'health-potion',
          },
        });

        eventBus.emit('MESSAGE_EMITTED', {
          text: `+ REPAIR CONSUMED: Restored 5 HP, +10 Stability, Nanite Regeneration active (3 turns)`,
          type: 'info',
        });
      }
      return 'USE_CONSUMABLE';
    }
    case 'DROP_ITEM': {
      const playerPos = world.getComponent(entityId, Position);
      if (!playerPos) return null;

      const dropX = action.targetX ?? playerPos.x;
      const dropY = action.targetY ?? playerPos.y;

      // 1. Distance check: Manhattan distance <= 1
      const dist = Math.abs(dropX - playerPos.x) + Math.abs(dropY - playerPos.y);
      if (dist > 1) {
        eventBus.emit('MESSAGE_EMITTED', {
          text: 'Cannot drop item: target tile is out of reach.',
          type: 'error',
        });
        return null;
      }

      // 2. Bounds and walkability check
      if (!grid.inBounds(dropX, dropY) || !grid.isWalkable(dropX, dropY)) {
        eventBus.emit('MESSAGE_EMITTED', {
          text: 'Cannot drop item: target tile is blocked or out of bounds.',
          type: 'error',
        });
        return null;
      }

      // 3. Ownership check: verify item is in player's inventory
      const inv = world.getComponent(entityId, RunInventory);
      const isOwned =
        inv?.software.some((s) => s.entityId === action.itemEntityId) ||
        inv?.equipment.some((e) => e.entityId === action.itemEntityId);

      if (!isOwned) {
        eventBus.emit('MESSAGE_EMITTED', {
          text: 'Cannot drop item: item is not in inventory.',
          type: 'error',
        });
        return null;
      }

      // Attach DropItemIntent (resolution happens inside ItemPickupSystem during turn phase)
      world.addComponent(entityId, DropItemIntent, {
        actorId: entityId,
        itemEntityId: action.itemEntityId,
        targetX: dropX,
        targetY: dropY,
      });
      return 'DROP_ITEM';
    }
    case 'INTERACT_PROP':
      world.addComponent(entityId, InteractPropIntent, {
        targetPropId: action.targetPropId,
        forceOverride: action.forceOverride,
        deadDropSelectionId: action.deadDropSelectionId,
      });
      return 'INTERACT_PROP';
    case 'DEAD_DROP_ITEM':
      world.addComponent(entityId, InteractPropIntent, {
        targetPropId: action.targetPropId,
        forceOverride: false,
        deadDropSelectionId: action.itemId,
      });
      return 'DEAD_DROP_ITEM';
    case 'ABORT_RUN':
      world.addComponent(entityId, Dying, {
        killerId: entityId,
        reason: 'OPERATOR_MANUAL_DESYNC',
      });
      return 'ABORT_RUN';
    case 'DEBUG_COMMAND':
      if (process.env.NODE_ENV !== 'production' && options?.sessionId) {
        handleServerDebugCommand(
          world,
          eventBus,
          entityId,
          options.sessionId,
          action.command,
          action.args,
          options.systems,
        );
      }
      return null;
  }
}
