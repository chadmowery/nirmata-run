import { diff } from 'json-diff-ts';
import { World } from '../engine/ecs/world';
import { Grid } from '../engine/grid/grid';
import { EventBus } from '../engine/events/event-bus';
import { GameplayEvents } from './events/types';
import { ActionIntent, StateDelta } from './types';
import { serializeWorld, serializeGrid, deserializeWorld, deserializeGrid } from './serialization';
import { logger } from './utils/logger';
import { Actor } from './components/actor';

import {
  Position, Hostile, BlocksMovement, Attack, Health, Defense, Item, PickupEffect, EffectType,
  SoftwareDef, BurnedSoftware, Heat,
  Stability, Scrap, AnchorMarker, FloorState
} from './components';
import { handleEquip, handleUnequip } from './systems/equipment';
import { runInventoryRegistry } from '../game/systems/run-inventory';
import { resolveDamage, collectDamageModifiers } from '../game/systems/combat';
import { checkAutoLoader, applyBleedOnHit, applyVampireOnKill } from '../game/systems/software-effects';
import {
  calculatePityScrap,
  calculateExtractionFluxBonus,
  mapInventoryToVaultItems
} from './utils/economy-util';

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

  // 3. Process Action
  processAction(newWorld, newGrid, localEventBus, playerId, action, sessionId);

  // 4. Flush internal events (e.g., BUMP_ATTACK -> DAMAGE_DEALT)
  // We need to register local handlers for things that link systems
  setupInternalHandlers(newWorld, newGrid, localEventBus, sessionId);
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
      handleMove(world, grid, eventBus, entityId, action.dx, action.dy);
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
      eventBus.emit('BUMP_ATTACK', { attackerId: entityId, defenderId: action.targetId });
      break;
    case 'EQUIP':
      handleEquip(world, eventBus, entityId, action.slotType, action.itemEntityId);
      break;
    case 'UNEQUIP':
      handleUnequip(world, eventBus, entityId, action.slotType, action.slotIndex);
      break;
    case 'BURN_SOFTWARE': {
      if (!sessionId) {
        eventBus.emit('MESSAGE_EMITTED', { text: 'Session ID required for burning software.', type: 'error' });
        return;
      }
      const inventory = runInventoryRegistry.getOrCreate(sessionId);
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
      const oldEntityId = burned[action.targetSlot];
      if (oldEntityId !== null) {
        world.destroyEntity(oldEntityId);
      }

      burned[action.targetSlot] = swItem.entityId;
      runInventoryRegistry.removeSoftware(sessionId, action.runInventoryIndex);

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
      handleMove(world, grid, eventBus, entityId, action.dx, action.dy);
      // Delegate to USE_FIRMWARE handling
      processAction(world, grid, eventBus, entityId, {
        type: 'USE_FIRMWARE',
        slotIndex: action.firmwareSlotIndex,
        targetX: action.targetX,
        targetY: action.targetY,
      });
      break;
    case 'ANCHOR_DESCEND': {
      if (!sessionId) {
        eventBus.emit('MESSAGE_EMITTED', { text: 'Session ID required for anchor descend.', type: 'error' });
        return;
      }
      const currentScrap = runInventoryRegistry.getCurrencyAmount(sessionId, 'scrap');
      if (currentScrap < action.cost) {
        eventBus.emit('MESSAGE_EMITTED', {
          text: `INSUFFICIENT_SCRAP: ${action.cost} REQUIRED`,
          type: 'error'
        });
        return;
      }
      runInventoryRegistry.removeCurrency(sessionId, 'scrap', action.cost);
      const stability = world.getComponent(entityId, Stability);
      if (stability) {
        const oldValue = stability.current;
        stability.current = Math.min(stability.max, stability.current + stability.max * 0.5);
        eventBus.emit('STABILITY_CHANGED', {
          entityId,
          oldValue,
          newValue: stability.current,
          reason: 'anchor_refill'
        });
      }
      const anchorMarker = world.getComponent(action.anchorId, AnchorMarker);
      if (anchorMarker) {
        anchorMarker.used = true;
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
    case 'PICKUP_CURRENCY':
      // Explicit pickup for prediction/authoritative sync
      if (sessionId) {
        const success = runInventoryRegistry.addCurrency(sessionId, action.currencyType, action.amount);
        if (success) {
          grid.removeItem(action.itemId, 0, 0); // Simplified, item-pickup handles actual grid removal
          world.destroyEntity(action.itemId);
          eventBus.emit('CURRENCY_PICKED_UP', {
            entityId,
            currencyType: action.currencyType,
            amount: action.amount
          });
        }
      }
      break;
  }
}

function handleMove(world: World<GameplayEvents>, grid: Grid, eventBus: EventBus<GameplayEvents>, entityId: number, dx: number, dy: number) {
  const pos = world.getComponent(entityId, Position);
  if (!pos) return;

  const targetX = pos.x + dx;
  const targetY = pos.y + dy;

  if (!grid.inBounds(targetX, targetY) || !grid.isWalkable(targetX, targetY)) {
    return;
  }

  const occupants = grid.getEntitiesAt(targetX, targetY);
  const attacker = world.getComponent(entityId, Actor);
  const isAttackerPlayer = attacker?.isPlayer ?? false;

  for (const occupantId of occupants) {
    if (occupantId === entityId) continue;

    const defenderHostile = world.hasComponent(occupantId, Hostile);
    const defenderActor = world.getComponent(occupantId, Actor);
    const isDefenderPlayer = defenderActor?.isPlayer ?? false;

    // Attack if: Player -> Hostile OR Hostile -> Player
    if ((isAttackerPlayer && defenderHostile) || (!isAttackerPlayer && isDefenderPlayer)) {
      eventBus.emit('BUMP_ATTACK', { attackerId: entityId, defenderId: occupantId });
      return;
    }

    if (world.hasComponent(occupantId, BlocksMovement)) {
      return;
    }
  }

  // Perform move
  const oldX = pos.x;
  const oldY = pos.y;
  pos.x = targetX;
  pos.y = targetY;
  grid.moveEntity(entityId, oldX, oldY, targetX, targetY);
  eventBus.emit('ENTITY_MOVED', { entityId, fromX: oldX, fromY: oldY, toX: targetX, toY: targetY });
}

function handlePickup(world: World<GameplayEvents>, grid: Grid, eventBus: EventBus<GameplayEvents>, entityId: number, itemId: number) {
  if (!world.hasComponent(itemId, Item)) return;

  const effect = world.getComponent(itemId, PickupEffect);
  if (effect && effect.type === EffectType.HEAL) {
    const health = world.getComponent(entityId, Health);
    if (health) {
      health.current = Math.min(health.max, health.current + effect.value);
    }
  }

  // Handle Scrap pickup
  const itemScrap = world.getComponent(itemId, Scrap);
  if (itemScrap) {
    const playerScrap = world.getComponent(entityId, Scrap);
    if (playerScrap) {
      playerScrap.amount += itemScrap.amount;
    }
  }

  const pos = world.getComponent(entityId, Position);
  if (pos) {
    grid.removeItem(itemId, pos.x, pos.y);
  }
  world.destroyEntity(itemId);
  eventBus.emit('ITEM_PICKED_UP', { entityId, itemId });
}

export function setupInternalHandlers(world: World<GameplayEvents>, grid: Grid, eventBus: EventBus<GameplayEvents>, sessionId?: string) {
  // BUMP_ATTACK handler (Combat Logic)
  eventBus.on('BUMP_ATTACK', (payload) => {
    const { attackerId, defenderId } = payload;
    const attackerAttack = world.getComponent(attackerId, Attack);
    const defenderHealth = world.getComponent(defenderId, Health);
    const defenderDefense = world.getComponent(defenderId, Defense);

    if (!attackerAttack || !defenderHealth) return;

    const modifiers = collectDamageModifiers(world, attackerId);
    const armor = defenderDefense?.armor ?? 0;
    const defenderHeat = world.getComponent(defenderId, Heat);
    const effectiveArmor = defenderHeat?.isVenting ? 0 : armor;

    const damage = resolveDamage(attackerAttack.power, modifiers, effectiveArmor);

    defenderHealth.current = Math.max(0, defenderHealth.current - damage);

    eventBus.emit('DAMAGE_DEALT', { attackerId, defenderId, amount: damage });

    // Apply software effects like Bleed
    applyBleedOnHit(world, eventBus, attackerId, defenderId);

    // Emit UI message
    const attackerActor = world.getComponent(attackerId, Actor);
    const defenderActor = world.getComponent(defenderId, Actor);
    const attackerName = attackerActor?.isPlayer ? 'You' : 'The enemy';
    const defenderName = defenderActor?.isPlayer ? 'you' : 'the enemy';

    eventBus.emit('MESSAGE_EMITTED', {
      text: `${attackerName} hit ${defenderName} for ${damage} damage.`,
      type: 'combat'
    });

    if (defenderHealth.current <= 0) {
      handleDeath(world, grid, eventBus, defenderId, attackerId);
    }
  });

  // ENTITY_MOVED handler (Auto-pickup Logic)
  eventBus.on('ENTITY_MOVED', (payload) => {
    const { entityId, toX, toY } = payload;
    const itemsAtPos = grid.getItemsAt(toX, toY);
    for (const itemId of Array.from(itemsAtPos)) {
      handlePickup(world, grid, eventBus, entityId, itemId);
    }
  });

  // ENTITY_DIED handler (Cleanup and Rewards)
  eventBus.on('ENTITY_DIED', (payload) => {
    const { entityId } = payload;
    
    // Clear burned software component
    const burned = world.getComponent(entityId, BurnedSoftware);
    if (burned) {
      burned.weapon = null;
      burned.armor = null;
    }

    const actor = world.getComponent(entityId, Actor);
    if (actor?.isPlayer && sessionId) {
      // Handle Pity on Failure
      const totalScrap = runInventoryRegistry.getCurrencyAmount(sessionId, 'scrap');
      const pityScrap = calculatePityScrap(totalScrap);

      runInventoryRegistry.clearCurrency(sessionId);
      if (pityScrap > 0) runInventoryRegistry.addCurrency(sessionId, 'scrap', pityScrap);
      runInventoryRegistry.clearSoftware(sessionId);

      eventBus.emit('MESSAGE_EMITTED', {
        text: `FATAL ERROR: SHELL_LOSS. Pity Scrap: ${pityScrap}`,
        type: 'error'
      });
    }
  });

  // ANCHOR_EXTRACT handler (Rewards)
  eventBus.on('ANCHOR_EXTRACT', () => {
    if (!sessionId) return;

    // This is the authoritative place where the pipeline applies rewards
    // so they are reflected in the DELTA.
    const playerActors = world.query(Actor);
    let playerId = -1;
    for (const pid of playerActors) {
      if (world.getComponent(pid, Actor)?.isPlayer) {
        playerId = pid;
        break;
      }
    }

    if (playerId !== -1) {
      const floorState = world.getComponent(playerId, FloorState);
      const floorNumber = floorState?.currentFloor ?? 1;

      const currentScrap = runInventoryRegistry.getCurrencyAmount(sessionId, 'scrap');
      const currentFlux = runInventoryRegistry.getCurrencyAmount(sessionId, 'flux');
      
      const fluxBonus = calculateExtractionFluxBonus(floorNumber);
      
      const inventory = runInventoryRegistry.getOrCreate(sessionId);
      const itemsExtracted = mapInventoryToVaultItems(inventory.software, floorNumber);

      // CLEAR inventory so it shows 0 in the UI/Delta
      runInventoryRegistry.clearCurrency(sessionId);
      runInventoryRegistry.clearSoftware(sessionId);

      eventBus.emit('RUN_ENDED', {
        reason: 'extraction',
        entityId: playerId,
        floorNumber,
        stats: {
          scrapExtracted: currentScrap,
          fluxExtracted: currentFlux + fluxBonus,
          softwareExtracted: itemsExtracted.length,
          pityAwarded: false,
          itemsExtracted,
        }
      });
    }
  });
}

function handleDeath(world: World<GameplayEvents>, grid: Grid, eventBus: EventBus<GameplayEvents>, entityId: number, killerId: number) {
  const pos = world.getComponent(entityId, Position);
  if (pos) {
    grid.removeEntity(entityId, pos.x, pos.y);
  }

  // Note: Loot generation requires EntityFactory which might have browser/asset dependencies.
  // For now, we skip loot in the pure pipeline, or we pass it in if needed.
  // ARCH deviation: If loot is critical for prediction, we need a pure version of EntityFactory.

  const actor = world.getComponent(entityId, Actor);
  eventBus.emit('ENTITY_DIED', { entityId, killerId, isPlayer: !!actor?.isPlayer });

  // Apply software effects like Vampire (heal on kill)
  applyVampireOnKill(world, eventBus, killerId);

  const name = actor?.isPlayer ? 'You' : 'The enemy';
  eventBus.emit('MESSAGE_EMITTED', {
    text: `${name} died!`,
    type: 'combat'
  });

  world.destroyEntity(entityId);
}
