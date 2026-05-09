import { World } from '../../engine/ecs/world';
import { Grid } from '../../engine/grid/grid';
import { EventBus } from '../../engine/events/event-bus';
import { Phase } from '@engine/ecs/types';
import { GameplayEvents } from '@shared/events/types';
import { Actor } from '@shared/components/actor';
import { Position } from '@shared/components/position';
import { MovedThisTurn } from '@shared/components/moved-this-turn';
import { Item } from '@shared/components/item';
import { PickupEffect, EffectType } from '@shared/components/pickup-effect';
import { Health } from '@shared/components/health';
import { CurrencyItem } from '@shared/components/currency-item';
import { TemplateId } from '@shared/components';
import * as InventoryUtil from '@shared/utils/inventory-util';
import { RarityTier } from '@shared/components/rarity-tier';
import { SoftwareDef } from '@shared/components/software-def';
import { FloorState } from '@shared/components/floor-state';

import { GameEvents } from '../events/types';

export type ItemPickupSystem<T extends GameplayEvents = GameEvents> = {
  init(): void;
  dispose(): void;
  update(world: World<T>): void;
};

export function createItemPickupSystem<T extends GameplayEvents>(
  world: World<T>,
  grid: Grid,
  eventBus: EventBus<T>
): ItemPickupSystem<T> {

  function update(w: World<T>) {
    // Phase 6.4: Query movers and filter for player
    const movers = w.query(Actor, MovedThisTurn, Position);

    for (const entityId of movers) {
      const actor = w.getComponent(entityId, Actor);
      if (!actor || !actor.isPlayer) {
        continue;
      }

      const moved = w.getComponent(entityId, MovedThisTurn)!;
      const toX = moved.toX;
      const toY = moved.toY;

      // 2. Get items at destination
      const itemsAtPos = grid.getItemsAt(toX, toY);
      if (itemsAtPos.size === 0) {
        continue;
      }

      // 3. Process each item (convert to array to avoid issues if set changes during iteration)
      const items = Array.from(itemsAtPos);
      for (const itemId of items) {
        // Security check: ensure it actually has the Item component
        if (!w.hasComponent(itemId, Item)) {
          continue;
        }

        // 4. Handle CurrencyItem (New System)
        const currencyItem = w.getComponent(itemId, CurrencyItem);
        if (currencyItem) {
          const type = currencyItem.currencyType;
          const amount = currencyItem.amount;
          const meta: { blueprintId?: string; blueprintType?: 'firmware' | 'augment' } = {
            blueprintId: currencyItem.blueprintId,
            blueprintType: currencyItem.blueprintType,
          };

          const success = InventoryUtil.addCurrency(w, entityId, type, amount, meta);

          if (success) {
            const message =
              type === 'blueprint'
                ? `+1 Locked File: ${meta.blueprintId}`
                : `+${amount} ${type.charAt(0).toUpperCase() + type.slice(1)}`;

            eventBus.emit('MESSAGE_EMITTED', { text: message, type: 'info' });
            eventBus.emit('CURRENCY_PICKED_UP', {
              entityId,
              currencyType: type,
              amount,
              blueprintId: meta.blueprintId,
            });

            // Cleanup and continue to next item
            grid.removeItem(itemId, toX, toY);
            w.destroyEntity(itemId);
            continue;
          } else {
            eventBus.emit('MESSAGE_EMITTED', {
              text: `Inventory full — cannot pick up ${type}`,
              type: 'error',
            });
            // Do not destroy, leave on ground
            continue;
          }
        }

        // 4.1 Handle Software item pickup
        const swDef = w.getComponent(itemId, SoftwareDef);
        if (swDef) {
          const rarity = w.getComponent(itemId, RarityTier);
          const templateRef = w.getComponent(itemId, TemplateId);
          const floorState = w.getComponent(entityId, FloorState);

          if (templateRef) {
            const added = InventoryUtil.addSoftware(w, entityId, {
              entityId: itemId,
              templateId: templateRef.id,
              rarityTier: rarity?.tier || 'v1.x',
              pickedUpAtFloor: floorState?.currentFloor || 1,
              pickedUpAtTimestamp: Date.now(),
            });

            if (added) {
              eventBus.emit('MESSAGE_EMITTED', {
                text: `+ SOFTWARE SECURED: ${swDef.name} [${rarity?.tier || 'v1.x'}]`,
                type: 'info',
              });

              grid.removeItem(itemId, toX, toY);
              // NOTE: We DO NOT destroy the entity here because it's now in the inventory.
              eventBus.emit('ITEM_PICKED_UP', { entityId, itemId });
              continue;
            } else {
              eventBus.emit('MESSAGE_EMITTED', {
                text: `INVENTORY FULL: Cannot secure ${swDef.name}`,
                type: 'error',
              });
              continue;
            }
          }
        }

        // 4.6 Apply pickup effect if it exists (e.g. Health Potions)
        const effect = w.getComponent(itemId, PickupEffect);
        if (effect) {
          if (effect.type === EffectType.HEAL) {
            const health = w.getComponent(entityId, Health);
            if (health) {
              w.patchComponent(entityId, Health, {
                current: Math.min(health.max, health.current + effect.value),
              });
            }
          }
        }

        // 5. Emit event for standard items
        eventBus.emit('ITEM_PICKED_UP', { entityId, itemId });

        // 6. Cleanup
        grid.removeItem(itemId, toX, toY);
        w.destroyEntity(itemId);
      }
    }
  }

  return {
    init() {
      world.registerSystem(Phase.REACTION, update);
    },
    dispose() {
      world.unregisterSystem(Phase.REACTION, update);
    },
    update,
  };
}
