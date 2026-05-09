import { World } from '@engine/ecs/world';
import { EntityId, Phase } from '@engine/ecs/types';
import { EventBus } from '@engine/events/event-bus';
import { GameplayEvents } from '@shared/events/types';
import { GameEvents } from '../events/types';
import {
  PortConfig, FirmwareSlots, AugmentSlots, SoftwareSlots,
  EquipIntent, UnequipIntent
} from '@shared/components';

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
  };

  const handleUnequip = (w: World<T>, entityId: EntityId, intent: any) => {
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
  };

  return {
    init() {
      world.registerSystem(Phase.ACTION, update);
    },
    dispose() {
      world.unregisterSystem(Phase.ACTION, update);
    },
    update,
  };
}

export type EquipmentSystem<T extends GameplayEvents = GameEvents> = ReturnType<typeof createEquipmentSystem<T>>;
