import { World } from '../../engine/ecs/world';
import { Grid } from '../../engine/grid/grid';
import { EventBus } from '../../engine/events/event-bus';
import { GameEvents } from '../events/types';
import { Actor } from '@shared/components/actor';
import { Item } from '@shared/components/item';
import { PickupEffect, EffectType } from '@shared/components/pickup-effect';
import { Health } from '@shared/components/health';

export interface ItemPickupSystem {
  init(): void;
  dispose(): void;
}

export function createItemPickupSystem(
  world: World,
  grid: Grid,
  eventBus: EventBus<GameEvents>
): ItemPickupSystem {

  function onEntityMoved(payload: GameEvents['ENTITY_MOVED']) {
    const { entityId, toX, toY } = payload;

    // 1. Check if mover is the player
    const actor = world.getComponent(entityId, Actor);
    if (!actor || !actor.isPlayer) {
      return;
    }

    // 2. Get items at destination
    const itemsAtPos = grid.getItemsAt(toX, toY);
    if (itemsAtPos.size === 0) {
      return;
    }

    // 3. Process each item (convert to array to avoid issues if set changes during iteration)
    const items = Array.from(itemsAtPos);
    for (const itemId of items) {
      // Security check: ensure it actually has the Item component
      if (!world.hasComponent(itemId, Item)) {
        continue;
      }

      // 4. Apply pickup effect if it exists
      const effect = world.getComponent(itemId, PickupEffect);
      if (effect) {
        if (effect.type === EffectType.HEAL) {
          const health = world.getComponent(entityId, Health);
          if (health) {
            health.current = Math.min(health.max, health.current + effect.value);
            // In some ECS implementations, we might need to notify the world about the change
            // but here we are modifying the reference if it's an object.
            // If it's a value type, we'd need world.updateComponent.
            // Looking at other systems, they seem to modify by reference if it's an object.
          }
        }
      }

      // 5. Emit event
      eventBus.emit('ITEM_PICKED_UP', { entityId, itemId });

      // 6. Cleanup
      grid.removeItem(itemId, toX, toY);
      world.destroyEntity(itemId);
    }
  }

  return {
    init() {
      eventBus.on('ENTITY_MOVED', onEntityMoved);
    },
    dispose() {
      eventBus.off('ENTITY_MOVED', onEntityMoved);
    },
  };
}
