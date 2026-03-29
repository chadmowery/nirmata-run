import { World } from '@engine/ecs/world';
import { EntityId } from '@engine/ecs/types';
import { PortConfig, FirmwareSlots, AugmentSlots, SoftwareSlots } from '@shared/components';
import { GameplayEvents } from '@shared/events/types';
import { EventBus } from '@engine/events/event-bus';

/**
 * Logic for equipping an item into a Shell slot.
 */
export function handleEquip(
  world: World<GameplayEvents>,
  events: EventBus<GameplayEvents>,
  entityId: EntityId,
  slotType: 'firmware' | 'augment' | 'software',
  itemEntityId: EntityId
): void {
  const portConfig = world.getComponent(entityId, PortConfig);
  if (!portConfig) {
    events.emit('MESSAGE_EMITTED', { text: "Entity has no PortConfig", type: 'error' });
    return;
  }

  let slotComponent;
  let maxSlots = 0;

  switch (slotType) {
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
  }

  const slots = world.getComponent(entityId, slotComponent);
  if (!slots) {
  events.emit('MESSAGE_EMITTED', { text: `Entity has no ${slotType} slots`, type: 'error' });
    return;
  }

  if (slots.equipped.length >= maxSlots) {
    events.emit('MESSAGE_EMITTED', { text: `No available ${slotType} ports`, type: 'error' });
    return;
  }

  // Add item to slots
  slots.equipped.push(itemEntityId);
  
  // Emit success event
  events.emit('EQUIPMENT_CHANGED', { entityId, slotType });
  events.emit('MESSAGE_EMITTED', { text: `Equipped item to ${slotType} slot`, type: 'info' });
}

/**
 * Logic for unequipping an item from a Shell slot.
 */
export function handleUnequip(
  world: World<GameplayEvents>,
  events: EventBus<GameplayEvents>,
  entityId: EntityId,
  slotType: 'firmware' | 'augment' | 'software',
  slotIndex: number
): void {
  let slotComponent;

  switch (slotType) {
    case 'firmware':
      slotComponent = FirmwareSlots;
      break;
    case 'augment':
      slotComponent = AugmentSlots;
      break;
    case 'software':
      slotComponent = SoftwareSlots;
      break;
  }

  const slots = world.getComponent(entityId, slotComponent);
  if (!slots || slotIndex < 0 || slotIndex >= slots.equipped.length) {
    events.emit('MESSAGE_EMITTED', { text: `Invalid ${slotType} slot index`, type: 'error' });
    return;
  }

  // Remove item from slots
  slots.equipped.splice(slotIndex, 1);
  
  // Emit success event
  events.emit('EQUIPMENT_CHANGED', { entityId, slotType });
  events.emit('MESSAGE_EMITTED', { text: `Unequipped item from ${slotType} slot`, type: 'info' });
}
