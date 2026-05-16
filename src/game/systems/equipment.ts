import { World } from '@engine/ecs/world';
import { EntityId, Phase } from '@engine/ecs/types';
import { EventBus } from '@engine/events/event-bus';
import { logger } from '@engine/utils/logger';
import { GameplayEvents } from '@shared/events/types';
import { GameEvents } from '../events/types';
import {
  PortConfig, FirmwareSlots, AugmentSlots, SoftwareSlots, EquipmentSlots,
  EquipIntent, UnequipIntent, RunInventory, TemplateId, RarityTier, FloorState
} from '@shared/components';
import * as InventoryUtil from '@shared/utils/inventory-util';

/**
 * System that processes equipment intent components.
 */
export function createEquipmentSystem<T extends GameplayEvents>(
  world: World<T>,
  eventBus: EventBus<T>
) {
  const update = (w: World<T>) => {
    // 1. Process EquipIntents
    const equipEntities = w.query(EquipIntent);
    for (const entityId of equipEntities) {
      const intent = w.getComponent(entityId, EquipIntent)!;
      handleEquip(w, entityId, intent);
      w.removeComponent(entityId, EquipIntent);
    }

    // 2. Process UnequipIntents
    const unequipEntities = w.query(UnequipIntent);
    for (const entityId of unequipEntities) {
      const intent = w.getComponent(entityId, UnequipIntent)!;
      handleUnequip(w, entityId, intent);
      w.removeComponent(entityId, UnequipIntent);
    }
  };

  const handleEquip = (w: World<T>, entityId: EntityId, intent: any) => {
    if (intent.slotType === 'weapon' || intent.slotType === 'armor') {
      const equipment = w.getComponent(entityId, EquipmentSlots);
      if (!equipment) return;

      const runInventory = w.getComponent(entityId, RunInventory);
      const slotKey = intent.slotType as 'weapon' | 'armor';
      const oldItemId = equipment[slotKey];

      let removedItem: any = null;
      let removedIndex = -1;

      if (runInventory) {
        removedIndex = runInventory.equipment.findIndex(item => item.entityId === intent.itemEntityId);
        if (removedIndex !== -1) {
          removedItem = InventoryUtil.removeEquipment(w, entityId, removedIndex);
        }
      }

      if (oldItemId !== null && runInventory) {
        const templateRef = w.getComponent(oldItemId, TemplateId);
        const rarity = w.getComponent(oldItemId, RarityTier);
        const floorState = w.getComponent(entityId, FloorState);

        const added = InventoryUtil.addEquipment(w, entityId, {
          entityId: oldItemId,
          templateId: templateRef?.id || 'unknown',
          rarityTier: rarity?.tier || 'v1.x',
          pickedUpAtFloor: floorState?.currentFloor || 1,
          pickedUpAtTimestamp: Date.now(),
        });

        if (!added) {
          // Revert removal of the new item
          if (removedItem) {
            const currentInv = w.getComponent(entityId, RunInventory);
            if (currentInv) {
              const eqList = [...currentInv.equipment];
              eqList.splice(removedIndex, 0, removedItem);
              w.patchComponent(entityId, RunInventory, { equipment: eqList });
            }
          }

          eventBus.emit('MESSAGE_EMITTED', { text: `Inventory full — cannot equip ${intent.slotType}`, type: 'error' } as any);
          return;
        }
      }

      const patch: any = {};
      patch[intent.slotType] = intent.itemEntityId;
      w.patchComponent(entityId, EquipmentSlots, patch);

      eventBus.emit('EQUIPMENT_CHANGED', { entityId, slotType: intent.slotType } as any);
      eventBus.emit('MESSAGE_EMITTED', { text: `${intent.slotType} equipped`, type: 'info' } as any);
      logger.info(`Entity ${entityId} equipped ${intent.itemEntityId} to ${intent.slotType}`, 'SYSTEM');
      return;
    }

    const portConfig = w.getComponent(entityId, PortConfig);
    if (!portConfig) {
      eventBus.emit('MESSAGE_EMITTED', { text: "Entity has no PortConfig", type: 'error' } as any);
      return;
    }

    let slotComponent;
    let maxSlots = 0;

    switch (intent.slotType) {
      case 'firmware':
        slotComponent = FirmwareSlots;
        maxSlots = portConfig.maxFirmware;
        break;
      case 'augment':
        slotComponent = AugmentSlots;
        maxSlots = portConfig.maxAugment;
        break;
      case 'software':
        slotComponent = SoftwareSlots;
        maxSlots = portConfig.maxSoftware;
        break;
      default:
        return;
    }

    const slots = w.getComponent(entityId, slotComponent);
    if (!slots) {
      eventBus.emit('MESSAGE_EMITTED', { text: `Entity has no ${intent.slotType} slots`, type: 'error' } as any);
      return;
    }

    if (slots.equipped.length >= maxSlots) {
      eventBus.emit('MESSAGE_EMITTED', { text: `No available ${intent.slotType} ports`, type: 'error' } as any);
      return;
    }

    // Add item to slots
    const newEquipped = [...slots.equipped, intent.itemEntityId];
    w.patchComponent(entityId, slotComponent, { equipped: newEquipped });

    eventBus.emit('EQUIPMENT_CHANGED', { entityId, slotType: intent.slotType } as any);
    eventBus.emit('MESSAGE_EMITTED', { text: `Equipped item to ${intent.slotType} slot`, type: 'info' } as any);
    logger.info(`Entity ${entityId} equipped item ${intent.itemEntityId} to ${intent.slotType} slot`, 'SYSTEM');
  };

  const handleUnequip = (w: World<T>, entityId: EntityId, intent: any) => {
    if (intent.slotType === 'weapon' || intent.slotType === 'armor') {
      const equipment = w.getComponent(entityId, EquipmentSlots);
      if (!equipment) return;

      const slotKey = intent.slotType as 'weapon' | 'armor';
      const oldItemId = equipment[slotKey];
      if (oldItemId === null) return;

      const runInventory = w.getComponent(entityId, RunInventory);
      if (runInventory) {
        const templateRef = w.getComponent(oldItemId, TemplateId);
        const rarity = w.getComponent(oldItemId, RarityTier);
        const floorState = w.getComponent(entityId, FloorState);

        const added = InventoryUtil.addEquipment(w, entityId, {
          entityId: oldItemId,
          templateId: templateRef?.id || 'unknown',
          rarityTier: rarity?.tier || 'v1.x',
          pickedUpAtFloor: floorState?.currentFloor || 1,
          pickedUpAtTimestamp: Date.now(),
        });

        if (!added) {
          eventBus.emit('MESSAGE_EMITTED', { text: `Inventory full — cannot unequip ${intent.slotType}`, type: 'error' } as any);
          return;
        }
      }

      const patch: any = {};
      patch[intent.slotType] = null;
      w.patchComponent(entityId, EquipmentSlots, patch);

      eventBus.emit('EQUIPMENT_CHANGED', { entityId, slotType: intent.slotType } as any);
      eventBus.emit('MESSAGE_EMITTED', { text: `${intent.slotType} unequipped`, type: 'info' } as any);
      logger.info(`Entity ${entityId} unequipped ${intent.slotType}`, 'SYSTEM');
      return;
    }

    let slotComponent;
    switch (intent.slotType) {
      case 'firmware':
        slotComponent = FirmwareSlots;
        break;
      case 'augment':
        slotComponent = AugmentSlots;
        break;
      case 'software':
        slotComponent = SoftwareSlots;
        break;
      default:
        return;
    }

    const slots = w.getComponent(entityId, slotComponent);
    if (!slots || intent.slotIndex < 0 || intent.slotIndex >= slots.equipped.length) {
      eventBus.emit('MESSAGE_EMITTED', { text: `Invalid ${intent.slotType} slot index`, type: 'error' } as any);
      return;
    }

    // Remove item from slots
    const newEquipped = [...slots.equipped];
    newEquipped.splice(intent.slotIndex, 1);
    w.patchComponent(entityId, slotComponent, { equipped: newEquipped });

    eventBus.emit('EQUIPMENT_CHANGED', { entityId, slotType: intent.slotType } as any);
    eventBus.emit('MESSAGE_EMITTED', { text: `Unequipped item from ${intent.slotType} slot`, type: 'info' } as any);
    logger.info(`Entity ${entityId} unequipped item at index ${intent.slotIndex} from ${intent.slotType} slot`, 'SYSTEM');
  };

  return {
    init() {
      world.registerSystem(Phase.ACTION, update, 'EquipmentSystem');
    },
    dispose() {
      world.unregisterSystem(Phase.ACTION, update);
    },
    update,
  };
}

export type EquipmentSystem<T extends GameplayEvents = GameEvents> = ReturnType<typeof createEquipmentSystem<T>>;

