import { diff } from 'json-diff-ts';
import { World } from '../engine/ecs/world';
import { Grid } from '../engine/grid/grid';
import { EventBus } from '../engine/events/event-bus';
import { ActionIntent, StateDelta } from './types';
import { serializeWorld, serializeGrid, deserializeWorld, deserializeGrid } from './serialization';

import { Position, Hostile, BlocksMovement, Attack, Health, Defense, Item, PickupEffect, EffectType } from './components';

/**
 * Runs a game action against a world/grid state and returns the new state and delta.
 * This is a pure function (it clones the input state).
 */
export function runActionPipeline(
  world: World,
  grid: Grid,
  playerId: number,
  action: ActionIntent
): { world: World; grid: Grid; delta: StateDelta } {
  // 1. Snapshot initial state
  const oldWorldState = serializeWorld(world);
  const oldGridState = serializeGrid(grid);

  // 2. Clone for processing (using a local event bus to avoid global side effects)
  const localEventBus = new EventBus<any>();
  const newWorld = deserializeWorld(oldWorldState, localEventBus);
  const newGrid = deserializeGrid(oldGridState);

  // 3. Process Action
  processAction(newWorld, newGrid, localEventBus, playerId, action);

  // 4. Flush internal events (e.g., BUMP_ATTACK -> DAMAGE_DEALT)
  // We need to register local handlers for things that link systems
  setupInternalHandlers(newWorld, newGrid, localEventBus);
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

function processAction(world: World, grid: Grid, eventBus: EventBus<any>, entityId: number, action: ActionIntent) {
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
  }
}

function handleMove(world: World, grid: Grid, eventBus: EventBus<any>, entityId: number, dx: number, dy: number) {
  const pos = world.getComponent(entityId, Position);
  // console.log(`DEBUG: handleMove entityId=${entityId} pos=`, pos);
  if (!pos) return;

  const targetX = pos.x + dx;
  const targetY = pos.y + dy;

  if (!grid.inBounds(targetX, targetY) || !grid.isWalkable(targetX, targetY)) {
    return;
  }

  const occupants = grid.getEntitiesAt(targetX, targetY);
  for (const occupantId of occupants) {
    if (occupantId === entityId) continue;

    if (world.hasComponent(occupantId, Hostile)) {
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

function handlePickup(world: World, grid: Grid, eventBus: EventBus<any>, entityId: number, itemId: number) {
  if (!world.hasComponent(itemId, Item)) return;

  const effect = world.getComponent(itemId, PickupEffect);
  if (effect && effect.type === EffectType.HEAL) {
    const health = world.getComponent(entityId, Health);
    if (health) {
      health.current = Math.min(health.max, health.current + effect.value);
    }
  }

  const pos = world.getComponent(entityId, Position);
  if (pos) {
    grid.removeItem(itemId, pos.x, pos.y);
  }
  world.destroyEntity(itemId);
  eventBus.emit('ITEM_PICKED_UP', { entityId, itemId });
}

function setupInternalHandlers(world: World, grid: Grid, eventBus: EventBus<any>) {
  // BUMP_ATTACK handler (Combat Logic)
  eventBus.on('BUMP_ATTACK', (payload: any) => {
    const { attackerId, defenderId } = payload;
    const attackerAttack = world.getComponent(attackerId, Attack);
    const defenderHealth = world.getComponent(defenderId, Health);
    const defenderDefense = world.getComponent(defenderId, Defense);

    if (!attackerAttack || !defenderHealth) return;

    const armor = defenderDefense?.armor ?? 0;
    const damage = Math.max(1, attackerAttack.power - armor);

    defenderHealth.current = Math.max(0, defenderHealth.current - damage);
    
    eventBus.emit('DAMAGE_DEALT', { attackerId, defenderId, amount: damage });

    if (defenderHealth.current <= 0) {
      handleDeath(world, grid, eventBus, defenderId, attackerId);
    }
  });

  // ENTITY_MOVED handler (Auto-pickup Logic)
  eventBus.on('ENTITY_MOVED', (payload: any) => {
    const { entityId, toX, toY } = payload;
    const itemsAtPos = grid.getItemsAt(toX, toY);
    for (const itemId of Array.from(itemsAtPos)) {
      handlePickup(world, grid, eventBus, entityId, itemId);
    }
  });
}

function handleDeath(world: World, grid: Grid, eventBus: EventBus<any>, entityId: number, killerId: number) {
  const pos = world.getComponent(entityId, Position);
  if (pos) {
    grid.removeEntity(entityId, pos.x, pos.y);
  }
  
  // Note: Loot generation requires EntityFactory which might have browser/asset dependencies.
  // For now, we skip loot in the pure pipeline, or we pass it in if needed.
  // ARCH deviation: If loot is critical for prediction, we need a pure version of EntityFactory.
  
  eventBus.emit('ENTITY_DIED', { entityId, killerId });
  world.destroyEntity(entityId);
}
