import { World } from '../../engine/ecs/world';
import { logger } from '@engine/utils/logger';
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
import {
  TemplateId,
  Dying,
  HealIntent,
  PickupIntent,
  SpriteComponent,
  AbilityDef,
  AugmentData,
  Health,
} from '@shared/components';
import * as InventoryUtil from '@shared/utils/inventory-util';
import { RarityTier } from '@shared/components/rarity-tier';
import { SoftwareDef } from '@shared/components/software-def';
import { EquipmentDef } from '@shared/components/equipment-def';
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
  eventBus: EventBus<T>,
): ItemPickupSystem<T> {
  function isItemLike(w: World<T>, id: number): boolean {
    return (
      w.hasComponent(id, Item) ||
      w.hasComponent(id, EquipmentDef) ||
      w.hasComponent(id, SoftwareDef) ||
      w.hasComponent(id, AbilityDef) ||
      w.hasComponent(id, AugmentData) ||
      w.hasComponent(id, PickupEffect) ||
      w.hasComponent(id, CurrencyItem)
    );
  }

  function processItem(
    w: World<T>,
    entityId: number,
    itemId: number,
    x: number,
    y: number,
    isExplicitPickup = false,
  ) {
    // Security check: ensure it actually has an item component signature and isn't already dying/picked up
    if (!isItemLike(w, itemId) || w.hasComponent(itemId, Dying)) {
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
        logger.info(
          `Entity ${entityId} picked up ${amount} ${type} (Blueprint: ${meta.blueprintId ?? 'none'})`,
          'SYSTEM',
        );
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
        } as unknown as T['CURRENCY_PICKED_UP']);

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

    // 2. Handle Equipment item pickup
    const eqDef = w.getComponent(itemId, EquipmentDef);
    if (eqDef) {
      const rarity = w.getComponent(itemId, RarityTier);
      const templateRef = w.getComponent(itemId, TemplateId);
      const floorState = w.getComponent(entityId, FloorState);

      if (templateRef) {
        const added = InventoryUtil.addEquipment(w, entityId, {
          entityId: itemId,
          templateId: templateRef.id,
          rarityTier: rarity?.tier || 'v1.x',
          pickedUpAtFloor: floorState?.currentFloor || 1,
          pickedUpAtTimestamp: Date.now(),
        });

        if (added) {
          logger.info(
            `Entity ${entityId} picked up equipment ${itemId} (Template: ${templateRef.id}, Name: ${eqDef.name})`,
            'SYSTEM',
          );
          eventBus.emit('MESSAGE_EMITTED', {
            text: `+ EQUIPMENT SECURED: ${eqDef.name} [${rarity?.tier || 'v1.x'}]`,
            type: 'info',
          });

          grid.removeItem(itemId, x, y);
          w.removeComponent(itemId, Position);
          if (w.hasComponent(itemId, SpriteComponent)) {
            w.removeComponent(itemId, SpriteComponent);
          }
          // NOTE: We DO NOT destroy the entity here because it's now in the inventory.
          eventBus.emit('ITEM_PICKED_UP', { entityId, itemId });
          return;
        } else {
          eventBus.emit('MESSAGE_EMITTED', {
            text: `INVENTORY FULL: Cannot secure ${eqDef.name}`,
            type: 'error',
          });
          return;
        }
      }
    }

    // 3. Handle Software item pickup
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
          logger.info(
            `Entity ${entityId} picked up software ${itemId} (Template: ${templateRef.id}, Name: ${swDef.name})`,
            'SYSTEM',
          );
          eventBus.emit('MESSAGE_EMITTED', {
            text: `+ SOFTWARE SECURED: ${swDef.name} [${rarity?.tier || 'v1.x'}]`,
            type: 'info',
          });

          grid.removeItem(itemId, x, y);
          w.removeComponent(itemId, Position);
          if (w.hasComponent(itemId, SpriteComponent)) {
            w.removeComponent(itemId, SpriteComponent);
          }
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

    // 4. Handle Firmware and Augment item pickup (stored in backpack, never auto-equipped)
    const abilityDef = w.getComponent(itemId, AbilityDef);
    const augmentData = w.getComponent(itemId, AugmentData);
    if (abilityDef || augmentData) {
      const rarity = w.getComponent(itemId, RarityTier);
      const templateRef = w.getComponent(itemId, TemplateId);
      const floorState = w.getComponent(entityId, FloorState);
      const itemName = abilityDef?.name || augmentData?.name || templateRef?.id || 'Hardware Mod';
      const typeLabel = abilityDef ? 'FIRMWARE' : 'AUGMENT';

      if (templateRef) {
        const added = InventoryUtil.addEquipment(w, entityId, {
          entityId: itemId,
          templateId: templateRef.id,
          rarityTier: rarity?.tier || 'v1.x',
          pickedUpAtFloor: floorState?.currentFloor || 1,
          pickedUpAtTimestamp: Date.now(),
        });

        if (added) {
          logger.info(
            `Entity ${entityId} secured ${typeLabel} ${itemId} (${templateRef.id}) into backpack`,
            'SYSTEM',
          );
          eventBus.emit('MESSAGE_EMITTED', {
            text: `+ ${typeLabel} SECURED: ${itemName} [${rarity?.tier || 'v1.x'}]`,
            type: 'info',
          });

          grid.removeItem(itemId, x, y);
          w.removeComponent(itemId, Position);
          if (w.hasComponent(itemId, SpriteComponent)) {
            w.removeComponent(itemId, SpriteComponent);
          }
          eventBus.emit('ITEM_PICKED_UP', { entityId, itemId });
          return;
        } else {
          eventBus.emit('MESSAGE_EMITTED', {
            text: `INVENTORY FULL: Cannot secure ${itemName}`,
            type: 'error',
          });
          return;
        }
      }
    }

    // 5. Apply pickup effect if it exists (e.g. Health Potions / Repair Kits)
    const effect = w.getComponent(itemId, PickupEffect);
    if (effect) {
      if (effect.type === EffectType.HEAL) {
        const health = w.getComponent(entityId, Health);
        const needsHeal = health ? health.current < health.max : false;

        if (!isExplicitPickup && needsHeal) {
          // Walk over heal: restore HP, clean up grid/components and destroy consumable entity
          w.addComponent(entityId, HealIntent, {
            targetId: entityId,
            amount: effect.value,
          });
          eventBus.emit('ITEM_PICKED_UP', { entityId, itemId });
          eventBus.emit('MESSAGE_EMITTED', {
            text: `+ REPAIR ACTIVATED: Restored ${effect.value} HP`,
            type: 'info',
          });
          grid.removeItem(itemId, x, y);
          if (w.hasComponent(itemId, Position)) {
            w.removeComponent(itemId, Position);
          }
          if (w.hasComponent(itemId, SpriteComponent)) {
            w.removeComponent(itemId, SpriteComponent);
          }
          w.addComponent(itemId, Dying, { reason: 'pickup' });
          return;
        } else if (isExplicitPickup) {
          // Explicit pickup: always store in player backpack (stacks of up to 10)
          const rarity = w.getComponent(itemId, RarityTier);
          const templateRef = w.getComponent(itemId, TemplateId);
          const floorState = w.getComponent(entityId, FloorState);

          const added = InventoryUtil.addConsumable(
            w,
            entityId,
            {
              entityId: itemId,
              templateId: templateRef?.id || 'health-potion',
              rarityTier: rarity?.tier || 'common',
              pickedUpAtFloor: floorState?.currentFloor || 1,
              pickedUpAtTimestamp: Date.now(),
            },
            10,
          );

          if (added) {
            eventBus.emit('MESSAGE_EMITTED', {
              text: `+ CONSUMABLE SECURED: Stored in backpack (Stack /10)`,
              type: 'info',
            });
            grid.removeItem(itemId, x, y);
            if (w.hasComponent(itemId, Position)) {
              w.removeComponent(itemId, Position);
            }
            if (w.hasComponent(itemId, SpriteComponent)) {
              w.removeComponent(itemId, SpriteComponent);
            }
            eventBus.emit('ITEM_PICKED_UP', { entityId, itemId });
            return;
          } else {
            eventBus.emit('MESSAGE_EMITTED', {
              text: `INVENTORY FULL: Cannot store health consumable`,
              type: 'error',
            });
            return;
          }
        }
      }
    }

    // 6. Handle Floor Vault Keys / Access Keys
    const itemComp = w.getComponent(itemId, Item);
    const tmplRef = w.getComponent(itemId, TemplateId);
    if (tmplRef?.id === 'item-access-key' || itemComp?.type === 'key') {
      const floorState = w.getComponent(entityId, FloorState);
      if (floorState) {
        w.patchComponent(entityId, FloorState, {
          accessKeysHeld: (floorState.accessKeysHeld ?? 0) + 1,
        });
      }
      eventBus.emit('MESSAGE_EMITTED', {
        text: `+ ACCESS KEY SECURED: Floor Vault Keycard`,
        type: 'info',
      });
      grid.removeItem(itemId, x, y);
      if (w.hasComponent(itemId, Position)) {
        w.removeComponent(itemId, Position);
      }
      if (w.hasComponent(itemId, SpriteComponent)) {
        w.removeComponent(itemId, SpriteComponent);
      }
      w.addComponent(itemId, Dying, { reason: 'pickup' });
      eventBus.emit('ITEM_PICKED_UP', { entityId, itemId });
      return;
    }

    // 7. Emit event for standard items
    eventBus.emit('ITEM_PICKED_UP', { entityId, itemId });

    // 8. Cleanup
    grid.removeItem(itemId, x, y);
    w.addComponent(itemId, Dying, { reason: 'pickup' });
  }

  function update(w: World<T>) {
    // 1. Process reactive pickups from movement (Currency always auto-picks up, health only if damaged)
    const movers = w.query(Actor, MovedThisTurn, Position);
    for (const entityId of movers) {
      if (!w.getComponent(entityId, Actor)?.isPlayer) continue;

      const moved = w.getComponent(entityId, MovedThisTurn)!;
      const items = Array.from(grid.getItemsAt(moved.toX, moved.toY));
      let hasManualLoot = false;

      for (const itemId of items) {
        const isCurrency = w.hasComponent(itemId, CurrencyItem);
        const effect = w.getComponent(itemId, PickupEffect);
        const health = w.getComponent(entityId, Health);
        const needsHeal = effect?.type === EffectType.HEAL && health ? health.current < health.max : false;

        if (isCurrency || needsHeal) {
          processItem(w, entityId, itemId, moved.toX, moved.toY);
        } else {
          hasManualLoot = true;
        }
      }

      if (hasManualLoot) {
        eventBus.emit('MESSAGE_EMITTED', {
          text: `[G] GROUND OBJECT DETECTED: Press [G] to pick up or transfer`,
          type: 'info',
        });
      }
    }

    // 2. Process explicit PickupIntents (e.g. from pipeline, G key, or transfer UI)
    const explicitPickups = w.query(PickupIntent);
    for (const requesterId of explicitPickups) {
      const intent = w.getComponent(requesterId, PickupIntent)!;
      let targetX: number | undefined;
      let targetY: number | undefined;
      let resolvedItemId = intent.itemId;

      const pos = w.getComponent(resolvedItemId, Position);
      if (pos) {
        targetX = pos.x;
        targetY = pos.y;
      } else if (intent.targetX !== undefined && intent.targetY !== undefined) {
        targetX = intent.targetX;
        targetY = intent.targetY;
      } else {
        const actorPos = w.getComponent(intent.actorId, Position);
        if (actorPos) {
          for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
              if (grid.getItemsAt(actorPos.x + dx, actorPos.y + dy).has(resolvedItemId)) {
                targetX = actorPos.x + dx;
                targetY = actorPos.y + dy;
                break;
              }
            }
            if (targetX !== undefined) break;
          }
        }
      }

      // Desync resilience: If the specified entity doesn't have an item signature or is Dying, find an item at target coordinates
      if (!isItemLike(w, resolvedItemId) || w.hasComponent(resolvedItemId, Dying)) {
        const searchCoords: Array<{ x: number; y: number }> = [];
        if (targetX !== undefined && targetY !== undefined) {
          searchCoords.push({ x: targetX, y: targetY });
        }
        if (intent.targetX !== undefined && intent.targetY !== undefined) {
          searchCoords.push({ x: intent.targetX, y: intent.targetY });
        }
        const actorPos = w.getComponent(intent.actorId, Position);
        if (actorPos) {
          searchCoords.push({ x: actorPos.x, y: actorPos.y });
          for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
              if (dx !== 0 || dy !== 0) searchCoords.push({ x: actorPos.x + dx, y: actorPos.y + dy });
            }
          }
        }
        for (const coord of searchCoords) {
          const itemsOnTile = grid.getItemsAt(coord.x, coord.y);
          for (const candId of itemsOnTile) {
            if (isItemLike(w, candId) && !w.hasComponent(candId, Dying)) {
              resolvedItemId = candId;
              targetX = coord.x;
              targetY = coord.y;
              break;
            }
          }
          if (isItemLike(w, resolvedItemId)) break;
        }
      }

      if (targetX !== undefined && targetY !== undefined) {
        processItem(w, intent.actorId, resolvedItemId, targetX, targetY, true);
      }
      w.removeComponent(requesterId, PickupIntent);
    }
  }

  return {
    init() {
      world.registerSystem(Phase.REACTION, update, 'ItemPickupSystem');
    },
    dispose() {
      world.unregisterSystem(Phase.REACTION, update);
    },
    update,
  };
}
