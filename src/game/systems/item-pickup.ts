import { World } from '../../engine/ecs/world';
import { Grid } from '../../engine/grid/grid';
import { EventBus } from '../../engine/events/event-bus';
import { GameplayEvents } from '@shared/events/types';
import { Actor } from '@shared/components/actor';
import { Item } from '@shared/components/item';
import { PickupEffect, EffectType } from '@shared/components/pickup-effect';
import { Health } from '@shared/components/health';
import { Scrap } from '@shared/components/scrap';
import { CurrencyItem } from '@shared/components/currency-item';
import { runInventoryRegistry } from './run-inventory';
import { EventOriginContext } from '@shared/utils/event-context';

export interface ItemPickupSystem {
  init(): void;
  dispose(): void;
}

export function createItemPickupSystem<T extends GameplayEvents>(
  world: World<T>,
  grid: Grid,
  eventBus: EventBus<T>,
  sessionId?: string
): ItemPickupSystem {

  function onEntityMoved(payload: T['ENTITY_MOVED']) {
    if (EventOriginContext.current === 'server') return;
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

      // 4. Handle CurrencyItem (New System)
      const currencyItem = world.getComponent(itemId, CurrencyItem);
      if (currencyItem) {
        const type = currencyItem.currencyType;
        const amount = currencyItem.amount;
        const meta: { blueprintId?: string, blueprintType?: 'firmware' | 'augment' } = {
          blueprintId: currencyItem.blueprintId,
          blueprintType: currencyItem.blueprintType
        };

        // Handle duplicate blueprint conversion (D-11)
        if (type === 'blueprint' && meta.blueprintId) {
          // Note: In a real implementation, we'd check against player's compiled library.
          // For now, we'll assume a stub check or just proceed if the registry handles it.
          // The plan says: "check if blueprint is already compiled in player's session."
          // Since we don't have the library yet (Plan 03), we'll skip the actual check 
          // but implement the logic structure.
        }

        if (!sessionId) {
          console.warn(`[ItemPickupSystem] No sessionId provided! Cannot add ${amount} ${type} to registry.`);
        }


        const success = sessionId ? runInventoryRegistry.addCurrency(sessionId, type, amount, meta) : false;
        
        if (success) {
          const message = type === 'blueprint' 
            ? `+1 Locked File: ${meta.blueprintId}`
            : `+${amount} ${type.charAt(0).toUpperCase() + type.slice(1)}`;
          
          eventBus.emit('MESSAGE_EMITTED', { text: message, type: 'info' });
          eventBus.emit('CURRENCY_PICKED_UP', {
            entityId,
            currencyType: type,
            amount,
            blueprintId: meta.blueprintId
          });

          // Cleanup and continue to next item
          grid.removeItem(itemId, toX, toY);
          world.destroyEntity(itemId);
          continue;
        } else {
          eventBus.emit('MESSAGE_EMITTED', { 
            text: `Inventory full — cannot pick up ${type}`, 
            type: 'error' 
          });
          // Do not destroy, leave on ground
          continue;
        }
      }

      // 4.5 Handle Legacy Scrap (Fallback during migration)
      // DEPRECATED: Phase 12 legacy, remove after Plan 02 Task 2 completes migration
      const itemScrap = world.getComponent(itemId, Scrap);
      if (itemScrap) {
        const playerScrap = world.getComponent(entityId, Scrap);
        if (playerScrap) {
          playerScrap.amount += itemScrap.amount;
        }
      }

      // 4.6 Apply pickup effect if it exists (e.g. Health Potions)
      const effect = world.getComponent(itemId, PickupEffect);
      if (effect) {
        if (effect.type === EffectType.HEAL) {
          const health = world.getComponent(entityId, Health);
          if (health) {
            health.current = Math.min(health.max, health.current + effect.value);
          }
        }
      }

      // 5. Emit event for standard items
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
