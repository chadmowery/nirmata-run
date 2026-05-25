import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { gameStore } from './store';
import { RunInventory } from '@shared/components/run-inventory';
import { EquipmentSlots } from '@shared/components/equipment-slots';

describe('gameStore', () => {
  beforeEach(() => {
    gameStore.setState({
      inventoryVisible: false,
      inventoryRevision: 0,
      optimisticWeapon: undefined,
      optimisticArmor: undefined,
      optimisticInventoryEquipmentIds: null,
    });
  });

  afterEach(() => {
    delete (window as any).gameContext;
  });

  it('should start with inventoryVisible false', () => {
    expect(gameStore.getState().inventoryVisible).toBe(false);
  });

  it('should toggle inventoryVisible', () => {
    gameStore.getState().toggleInventory();
    expect(gameStore.getState().inventoryVisible).toBe(true);
    gameStore.getState().toggleInventory();
    expect(gameStore.getState().inventoryVisible).toBe(false);
  });

  it('should handle optimisticEquipItem', () => {
    const mockInventory = {
      equipment: [{ entityId: 101 }, { entityId: 102 }]
    };
    (window as any).gameContext = {
      playerId: 1,
      world: {
        getComponent: (id: number, comp: any) => {
          if (id === 1 && comp === RunInventory) {
            return mockInventory;
          }
          return null;
        }
      }
    };

    gameStore.getState().optimisticEquipItem(101, 'weapon');
    expect(gameStore.getState().optimisticWeapon).toBe(101);
    expect(gameStore.getState().optimisticInventoryEquipmentIds).toEqual([102]);
  });

  it('should handle optimisticUnequipItem', () => {
    const mockSlots = {
      weapon: 101,
      armor: 102
    };
    const mockInventory = {
      equipment: []
    };
    (window as any).gameContext = {
      playerId: 1,
      world: {
        getComponent: (id: number, comp: any) => {
          if (id === 1 && comp === EquipmentSlots) {
            return mockSlots;
          }
          if (id === 1 && comp === RunInventory) {
            return mockInventory;
          }
          return null;
        }
      }
    };

    gameStore.getState().optimisticUnequipItem('weapon');
    expect(gameStore.getState().optimisticWeapon).toBe(null);
    expect(gameStore.getState().optimisticInventoryEquipmentIds).toEqual([101]);
  });

  it('should clear optimistic updates', () => {
    gameStore.setState({
      optimisticWeapon: 101,
      optimisticArmor: 102,
      optimisticInventoryEquipmentIds: [103]
    });
    gameStore.getState().clearOptimisticUpdates();
    expect(gameStore.getState().optimisticWeapon).toBe(undefined);
    expect(gameStore.getState().optimisticArmor).toBe(undefined);
    expect(gameStore.getState().optimisticInventoryEquipmentIds).toBe(null);
  });
});
