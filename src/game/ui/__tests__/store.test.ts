import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { gameStore } from '../store';
import { GameState } from '../../states/types';
import { RunInventory } from '@shared/components/run-inventory';
import { EquipmentSlots } from '@shared/components/equipment-slots';

describe('UI gameStore Comprehensive Tests', () => {
  beforeEach(() => {
    // Reset store state before each test
    gameStore.setState({
      player: {
        hp: 0,
        maxHp: 0,
        xp: 0,
        level: 1,
        statuses: [],
        heat: 0,
        maxHeat: 100,
        shellName: 'None',
        mods: [],
      },
      messages: [],
      gameStatus: GameState.Loading,
      visibleEntities: [],
      heatTier: 0,
      heatValue: 0,
      heatMaxSafe: 100,
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

  describe('Player Stats & Game Status', () => {
    it('should update player stats', () => {
      gameStore.getState().updatePlayerStats({ hp: 10, maxHp: 20, xp: 50, level: 2 });
      const state = gameStore.getState();
      expect(state.player.hp).toBe(10);
      expect(state.player.maxHp).toBe(20);
      expect(state.player.xp).toBe(50);
      expect(state.player.level).toBe(2);
    });

    it('should update game status', () => {
      gameStore.getState().setGameStatus(GameState.Playing);
      expect(gameStore.getState().gameStatus).toBe(GameState.Playing);
    });

    it('should update visible entities', () => {
      const enemies = [
        { id: 10, name: 'Orc', hp: 10, maxHp: 10 },
        { id: 11, name: 'Goblin', hp: 5, maxHp: 5 },
      ];
      gameStore.getState().setVisibleEntities(enemies);
      expect(gameStore.getState().visibleEntities).toEqual(enemies);
    });
  });

  describe('Message Log', () => {
    it('should add messages', () => {
      gameStore.getState().addMessage('Hello world', 'info');
      const state = gameStore.getState();
      expect(state.messages).toHaveLength(1);
      expect(state.messages[0].text).toBe('Hello world');
      expect(state.messages[0].count).toBe(1);
    });

    it('should collapse identical consecutive messages', () => {
      gameStore.getState().addMessage('Ouch', 'combat');
      gameStore.getState().addMessage('Ouch', 'combat');
      gameStore.getState().addMessage('Ouch', 'combat');

      const state = gameStore.getState();
      expect(state.messages).toHaveLength(1);
      expect(state.messages[0].text).toBe('Ouch');
      expect(state.messages[0].count).toBe(3);
    });

    it('should not collapse different consecutive messages', () => {
      gameStore.getState().addMessage('Ouch', 'combat');
      gameStore.getState().addMessage('Critical!', 'combat');

      const state = gameStore.getState();
      expect(state.messages).toHaveLength(2);
      expect(state.messages[0].text).toBe('Critical!');
      expect(state.messages[1].text).toBe('Ouch');
    });

    it('should cap the message log at 50 entries', () => {
      for (let i = 0; i < 60; i++) {
        gameStore.getState().addMessage(`Message ${i}`, 'info');
      }

      const state = gameStore.getState();
      expect(state.messages).toHaveLength(50);
      expect(state.messages[0].text).toBe('Message 59');
    });
  });

  describe('Inventory & Optimistic Equipment Updates', () => {
    it('should toggle inventory visibility', () => {
      expect(gameStore.getState().inventoryVisible).toBe(false);
      gameStore.getState().toggleInventory();
      expect(gameStore.getState().inventoryVisible).toBe(true);
      gameStore.getState().toggleInventory();
      expect(gameStore.getState().inventoryVisible).toBe(false);
    });

    it('should handle optimisticEquipItem', () => {
      const mockInventory = {
        equipment: [{ entityId: 101 }, { entityId: 102 }],
      };
      (window as any).gameContext = {
        playerId: 1,
        world: {
          getComponent: (id: number, comp: any) => {
            if (id === 1 && comp === RunInventory) {
              return mockInventory;
            }
            return null;
          },
        },
      };

      gameStore.getState().optimisticEquipItem(101, 'weapon');
      expect(gameStore.getState().optimisticWeapon).toBe(101);
      expect(gameStore.getState().optimisticInventoryEquipmentIds).toEqual([102]);
    });

    it('should handle optimisticUnequipItem', () => {
      const mockSlots = {
        weapon: 101,
        armor: 102,
      };
      const mockInventory = {
        equipment: [],
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
          },
        },
      };

      gameStore.getState().optimisticUnequipItem('weapon');
      expect(gameStore.getState().optimisticWeapon).toBe(null);
      expect(gameStore.getState().optimisticInventoryEquipmentIds).toEqual([101]);
    });

    it('should clear optimistic updates', () => {
      gameStore.setState({
        optimisticWeapon: 101,
        optimisticArmor: 102,
        optimisticInventoryEquipmentIds: [103],
      });
      gameStore.getState().clearOptimisticUpdates();
      expect(gameStore.getState().optimisticWeapon).toBe(undefined);
      expect(gameStore.getState().optimisticArmor).toBe(undefined);
      expect(gameStore.getState().optimisticInventoryEquipmentIds).toBe(null);
    });
  });
});
