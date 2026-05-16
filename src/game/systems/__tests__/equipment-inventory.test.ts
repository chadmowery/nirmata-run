import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '@engine/ecs/world';
import { EventBus } from '@engine/events/event-bus';
import { Phase } from '@engine/ecs/types';
import { GameplayEvents } from '@shared/events/types';
import {
  EquipmentSlots, RunInventory, RunCurrency, EquipIntent, UnequipIntent,
  TemplateId, RarityTier, FloorState
} from '@shared/components';
import { createEquipmentSystem } from '../equipment';

describe('Equipment System — Inventory Integration', () => {
  let eventBus: EventBus<GameplayEvents>;
  let world: World<GameplayEvents>;
  let playerId: number;

  beforeEach(() => {
    eventBus = new EventBus<GameplayEvents>();
    world = new World<GameplayEvents>(eventBus);

    const system = createEquipmentSystem(world, eventBus);
    system.init();

    playerId = world.createEntity();
    world.addComponent(playerId, EquipmentSlots, { weapon: null, armor: null });
    world.addComponent(playerId, RunInventory, { software: [], equipment: [], maxSlots: 5 });
    world.addComponent(playerId, RunCurrency, { stacks: [] });
    world.addComponent(playerId, FloorState, { currentFloor: 1, maxFloor: 10, runSeed: 'test' });
  });

  it('should remove equipped weapon from RunInventory and assign to EquipmentSlots', () => {
    const weaponEntity = world.createEntity();
    world.addComponent(weaponEntity, TemplateId, { id: 'katana' });
    world.addComponent(weaponEntity, RarityTier, { tier: 'v1.x', scaleFactor: 1.5, minFloor: 0 });

    // Add weapon to inventory
    world.patchComponent(playerId, RunInventory, {
      equipment: [{
        entityId: weaponEntity,
        templateId: 'katana',
        rarityTier: 'v1.x',
        pickedUpAtFloor: 1,
        pickedUpAtTimestamp: Date.now(),
      }]
    });

    // Act: Equip weapon
    world.addComponent(playerId, EquipIntent, { slotType: 'weapon', itemEntityId: weaponEntity });
    world.executeSystems(Phase.ACTION);

    const eq = world.getComponent(playerId, EquipmentSlots);
    const inv = world.getComponent(playerId, RunInventory);

    expect(eq?.weapon).toBe(weaponEntity);
    expect(inv?.equipment).toHaveLength(0);
  });

  it('should return old weapon to RunInventory when equipping a new weapon', () => {
    const oldWeapon = world.createEntity();
    world.addComponent(oldWeapon, TemplateId, { id: 'old-blade' });
    world.addComponent(oldWeapon, RarityTier, { tier: 'v0.x', scaleFactor: 1, minFloor: 0 });

    const newWeapon = world.createEntity();
    world.addComponent(newWeapon, TemplateId, { id: 'new-blade' });
    world.addComponent(newWeapon, RarityTier, { tier: 'v2.x', scaleFactor: 2, minFloor: 0 });

    // Initial state: old weapon equipped, new weapon in inventory
    world.patchComponent(playerId, EquipmentSlots, { weapon: oldWeapon, armor: null });
    world.patchComponent(playerId, RunInventory, {
      equipment: [{
        entityId: newWeapon,
        templateId: 'new-blade',
        rarityTier: 'v2.x',
        pickedUpAtFloor: 1,
        pickedUpAtTimestamp: Date.now(),
      }]
    });

    // Act: Equip new weapon
    world.addComponent(playerId, EquipIntent, { slotType: 'weapon', itemEntityId: newWeapon });
    world.executeSystems(Phase.ACTION);

    const eq = world.getComponent(playerId, EquipmentSlots);
    const inv = world.getComponent(playerId, RunInventory);

    expect(eq?.weapon).toBe(newWeapon);
    expect(inv?.equipment).toHaveLength(1);
    expect(inv?.equipment[0].entityId).toBe(oldWeapon);
    expect(inv?.equipment[0].templateId).toBe('old-blade');
  });

  it('should return unequipped weapon to RunInventory', () => {
    const weaponEntity = world.createEntity();
    world.addComponent(weaponEntity, TemplateId, { id: 'katana' });
    world.addComponent(weaponEntity, RarityTier, { tier: 'v1.x', scaleFactor: 1.5, minFloor: 0 });

    world.patchComponent(playerId, EquipmentSlots, { weapon: weaponEntity, armor: null });

    // Act: Unequip weapon
    world.addComponent(playerId, UnequipIntent, { slotType: 'weapon', slotIndex: 0 });
    world.executeSystems(Phase.ACTION);

    const eq = world.getComponent(playerId, EquipmentSlots);
    const inv = world.getComponent(playerId, RunInventory);

    expect(eq?.weapon).toBeNull();
    expect(inv?.equipment).toHaveLength(1);
    expect(inv?.equipment[0].entityId).toBe(weaponEntity);
  });

  it('should fail to unequip if RunInventory is full', () => {
    const weaponEntity = world.createEntity();
    world.addComponent(weaponEntity, TemplateId, { id: 'katana' });
    world.addComponent(weaponEntity, RarityTier, { tier: 'v1.x', scaleFactor: 1.5, minFloor: 0 });

    world.patchComponent(playerId, EquipmentSlots, { weapon: weaponEntity, armor: null });

    // Fill inventory to maxSlots (5)
    const dummyItems = Array.from({ length: 5 }).map((_, i) => ({
      entityId: 100 + i,
      templateId: `dummy-${i}`,
      rarityTier: 'v0.x',
      pickedUpAtFloor: 1,
      pickedUpAtTimestamp: Date.now(),
    }));
    world.patchComponent(playerId, RunInventory, { equipment: dummyItems });

    let errorEmitted = false;
    eventBus.on('MESSAGE_EMITTED', (msg: any) => {
      if (msg.type === 'error' && msg.text.includes('Inventory full')) {
        errorEmitted = true;
      }
    });

    // Act: Unequip weapon
    world.addComponent(playerId, UnequipIntent, { slotType: 'weapon', slotIndex: 0 });
    world.executeSystems(Phase.ACTION);
    eventBus.flush();

    const eq = world.getComponent(playerId, EquipmentSlots);
    const inv = world.getComponent(playerId, RunInventory);

    // Weapon should remain equipped
    expect(eq?.weapon).toBe(weaponEntity);
    expect(inv?.equipment).toHaveLength(5);
    expect(errorEmitted).toBe(true);
  });
});
