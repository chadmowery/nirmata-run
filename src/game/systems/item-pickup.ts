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
  PickupIntent,
  DropItemIntent,
  SpriteComponent,
  AbilityDef,
  AugmentData,
  Health,
  RunInventory,
} from '@shared/components';
import * as InventoryUtil from '@shared/utils/inventory-util';
import { RarityTier } from '@shared/components/rarity-tier';
import { SoftwareDef } from '@shared/components/software-def';
import { EquipmentDef } from '@shared/components/equipment-def';
import { FloorState } from '@shared/components/floor-state';
import { addHealIntent } from './combat';

import { GameEvents } from '../events/types';

/** Atlas frame used by every heal consumable (matches `health-potion.json`). */
const CONSUMABLE_SPRITE_KEY = 'item_potion';

/** Display metadata for consumables re-materialised on the floor from a RunInventory stack. */
const CONSUMABLE_DISPLAY: Record<string, { name: string; description?: string }> = {
  'health-potion': {
    name: 'Health Potion',
    description:
      'Restores 5 HP and 10 Stability immediately, plus 3 turns of regenerative repair nanites. Stacks up to 10 per slot.',
  },
};

export type ItemPickupSystem<T extends GameplayEvents = GameEvents> = {
  init(): void;
  dispose(): void;
  update(world: World<T>): void;
};

export function isItemLike<T extends GameplayEvents>(w: World<T>, id: number): boolean {
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

export function createItemPickupSystem<T extends GameplayEvents>(
  world: World<T>,
  grid: Grid,
  eventBus: EventBus<T>,
): ItemPickupSystem<T> {

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
          // Keep SpriteComponent: renderers query (SpriteComponent, Position), so removing
          // Position alone hides the entity, and the atlas key survives a later drop (U4).
          w.removeComponent(itemId, Position);
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
          // Keep SpriteComponent: renderers query (SpriteComponent, Position), so removing
          // Position alone hides the entity, and the atlas key survives a later drop (U4).
          w.removeComponent(itemId, Position);
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
          addHealIntent(w, entityId, entityId, effect.value);
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
      let actorPos = w.getComponent(intent.actorId, Position);
      if (!actorPos) {
        for (let x = 0; x < grid.width; x++) {
          for (let y = 0; y < grid.height; y++) {
            if (grid.getEntitiesAt(x, y).has(intent.actorId)) {
              actorPos = { x, y };
              break;
            }
          }
          if (actorPos) break;
        }
      }

      if (!actorPos) {
        w.removeComponent(requesterId, PickupIntent);
        continue;
      }

      const itemId = intent.itemId;

      // Fail loudly: ensure the specified entity exists, is item-like, and is not dying
      if (
        (w.entityExists && !w.entityExists(itemId)) ||
        !isItemLike(w, itemId) ||
        w.hasComponent(itemId, Dying)
      ) {
        eventBus.emit('MESSAGE_EMITTED', {
          text: 'Cannot pick up: item does not exist or was already removed.',
          type: 'error',
        });
        w.removeComponent(requesterId, PickupIntent);
        continue;
      }

      let targetX: number | undefined;
      let targetY: number | undefined;

      const pos = w.getComponent(itemId, Position);
      if (pos) {
        targetX = pos.x;
        targetY = pos.y;
      } else if (
        intent.targetX !== undefined &&
        intent.targetY !== undefined &&
        grid.getItemsAt(intent.targetX, intent.targetY).has(itemId)
      ) {
        targetX = intent.targetX;
        targetY = intent.targetY;
      } else {
        // Search immediate adjacent tiles (Manhattan <= 1) for the item on the grid
        for (let dx = -1; dx <= 1; dx++) {
          for (let dy = -1; dy <= 1; dy++) {
            if (
              Math.abs(dx) + Math.abs(dy) <= 1 &&
              grid.getItemsAt(actorPos.x + dx, actorPos.y + dy).has(itemId)
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
          text: 'Cannot pick up: item location unknown or not found on grid.',
          type: 'error',
        });
        w.removeComponent(requesterId, PickupIntent);
        continue;
      }

      // Adjacency check: Manhattan distance <= 1 to actor
      const dist = Math.abs(targetX - actorPos.x) + Math.abs(targetY - actorPos.y);
      if (dist > 1) {
        eventBus.emit('MESSAGE_EMITTED', {
          text: 'Cannot pick up: item is out of reach.',
          type: 'error',
        });
        w.removeComponent(requesterId, PickupIntent);
        continue;
      }

      processItem(w, intent.actorId, itemId, targetX, targetY, true);
      w.removeComponent(requesterId, PickupIntent);
    }

    // 3. Process explicit DropItemIntents
    const explicitDrops = w.query(DropItemIntent);
    for (const requesterId of explicitDrops) {
      const intent = w.getComponent(requesterId, DropItemIntent)!;
      const inv = w.getComponent(intent.actorId, RunInventory);
      const eqIdx = inv?.equipment.findIndex((e) => e.entityId === intent.itemEntityId) ?? -1;
      const eqEntry = eqIdx !== -1 ? inv?.equipment[eqIdx] : undefined;

      let removed: ReturnType<typeof InventoryUtil.removeItemByEntityId> = null;
      let droppedSingleFromStack = false;

      if (eqEntry && eqEntry.isConsumable && (eqEntry.quantity ?? 1) > 1) {
        removed = InventoryUtil.consumeConsumable(w, intent.actorId, eqIdx);
        droppedSingleFromStack = true;
      } else {
        removed = InventoryUtil.removeItemByEntityId(
          w,
          intent.actorId,
          intent.itemEntityId,
        );
      }

      if (removed) {
        // A fresh ground entity is needed when a unit is split off a stack, or when the
        // original entity no longer exists. Otherwise the original entity is re-used.
        const reuseOriginal = !droppedSingleFromStack && w.entityExists(intent.itemEntityId);
        const dropEntityId = reuseOriginal ? intent.itemEntityId : w.createEntity();

        if (removed.isConsumable) {
          // Consumables must be fully pickup-able again: restore every component that
          // `ItemPickupSystem.processItem` relies on (Item, PickupEffect, TemplateId).
          if (!w.hasComponent(dropEntityId, Item)) {
            w.addComponent(dropEntityId, Item, {
              name: CONSUMABLE_DISPLAY[removed.templateId]?.name ?? removed.templateId,
              description: CONSUMABLE_DISPLAY[removed.templateId]?.description,
              type: 'consumable',
            });
          }
          if (!w.hasComponent(dropEntityId, PickupEffect)) {
            w.addComponent(dropEntityId, PickupEffect, { type: EffectType.HEAL, value: 5 });
          }
        } else if (!w.hasComponent(dropEntityId, Item)) {
          w.addComponent(dropEntityId, Item, {
            name: removed.templateId,
            type: 'equipment',
          });
        }
        if (!w.hasComponent(dropEntityId, TemplateId)) {
          w.addComponent(dropEntityId, TemplateId, { id: removed.templateId });
        }
        w.addComponent(dropEntityId, Position, { x: intent.targetX, y: intent.targetY });
        if (!w.hasComponent(dropEntityId, SpriteComponent)) {
          w.addComponent(dropEntityId, SpriteComponent, {
            key: removed.isConsumable
              ? CONSUMABLE_SPRITE_KEY
              : removed.templateId || 'item',
          });
        }
        grid.addItem(dropEntityId, intent.targetX, intent.targetY);
        eventBus.emit('MESSAGE_EMITTED', {
          text: `Dropped ${removed.templateId} onto floor`,
          type: 'info',
        });
      }
      w.removeComponent(requesterId, DropItemIntent);
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
