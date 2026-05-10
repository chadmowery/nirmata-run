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
import { CurrencyItem } from '@shared/components/currency-item';
import { TemplateId, Dying, HealIntent, PickupIntent } from '@shared/components';
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

  function processItem(w: World<T>, entityId: number, itemId: number, x: number, y: number) {
    // Security check: ensure it actually has the Item component
    if (!w.hasComponent(itemId, Item)) {
      return;
    }

    // 1. Handle CurrencyItem
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

        // Cleanup
        grid.removeItem(itemId, x, y);
        w.addComponent(itemId, Dying, { reason: 'pickup' });
        return;
      } else {
        eventBus.emit('MESSAGE_EMITTED', {
          text: `Inventory full — cannot pick up ${type}`,
          type: 'error',
        });
        return;
      }
    }

    // 2. Handle Software item pickup
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

          grid.removeItem(itemId, x, y);
          // NOTE: We DO NOT destroy the entity here because it's now in the inventory.
          eventBus.emit('ITEM_PICKED_UP', { entityId, itemId });
          return;
        } else {
          eventBus.emit('MESSAGE_EMITTED', {
            text: `INVENTORY FULL: Cannot secure ${swDef.name}`,
            type: 'error',
          });
          return;
        }
      }
    }

    // 3. Apply pickup effect if it exists (e.g. Health Potions)
    const effect = w.getComponent(itemId, PickupEffect);
    if (effect) {
      if (effect.type === EffectType.HEAL) {
        w.addComponent(entityId, HealIntent, {
          targetId: entityId,
          amount: effect.value
        });
      }
    }

    // 4. Emit event for standard items
    eventBus.emit('ITEM_PICKED_UP', { entityId, itemId });

    // 5. Cleanup
    grid.removeItem(itemId, x, y);
    w.addComponent(itemId, Dying, { reason: 'pickup' });
  }

  function update(w: World<T>) {
    // 1. Process reactive pickups from movement
    const movers = w.query(Actor, MovedThisTurn, Position);
    for (const entityId of movers) {
      if (!w.getComponent(entityId, Actor)?.isPlayer) continue;

      const moved = w.getComponent(entityId, MovedThisTurn)!;
      const items = Array.from(grid.getItemsAt(moved.toX, moved.toY));
      for (const itemId of items) {
        processItem(w, entityId, itemId, moved.toX, moved.toY);
      }
    }

    // 2. Process explicit PickupIntents (e.g. from pipeline or UI)
    const explicitPickups = w.query(PickupIntent);
    for (const requesterId of explicitPickups) {
      const intent = w.getComponent(requesterId, PickupIntent)!;
      const pos = w.getComponent(intent.itemId, Position);
      if (pos) {
        processItem(w, intent.actorId, intent.itemId, pos.x, pos.y);
      }
      w.removeComponent(requesterId, PickupIntent);
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
