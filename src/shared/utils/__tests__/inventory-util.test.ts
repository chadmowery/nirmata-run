import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '@engine/ecs/world';
import { EventBus } from '@engine/events/event-bus';
import { EngineEvents } from '@engine/events/types';
import { RunInventory, RunCurrency, RunInventoryItem } from '../../components/run-inventory';
import {
  getCurrencyAmount,
  addCurrency,
  removeCurrency,
  addSoftware,
  addEquipment,
  removeSoftware,
  addConsumable,
  consumeConsumable,
} from '../inventory-util';

describe('Inventory Utilities Unit Tests', () => {
  let world: World<EngineEvents>;
  let playerId: number;

  const makeItem = (id: number, templateId: string, rarityTier = 'common'): RunInventoryItem => ({
    entityId: id,
    templateId,
    rarityTier,
    pickedUpAtFloor: 1,
    pickedUpAtTimestamp: Date.now(),
  });

  beforeEach(() => {
    const bus = new EventBus<EngineEvents>();
    world = new World<EngineEvents>(bus);
    playerId = world.createEntity();

    world.addComponent(playerId, RunInventory, {
      software: [],
      equipment: [],
      maxSlots: 10,
    });

    world.addComponent(playerId, RunCurrency, {
      stacks: [],
    });
  });

  describe('Currency Operations', () => {
    it('returns 0 when no currency stacks exist', () => {
      expect(getCurrencyAmount(world, playerId, 'scrap')).toBe(0);
    });

    it('adds currency to existing stack', () => {
      expect(addCurrency(world, playerId, 'scrap', 50)).toBe(true);
      expect(getCurrencyAmount(world, playerId, 'scrap')).toBe(50);

      expect(addCurrency(world, playerId, 'scrap', 25)).toBe(true);
      expect(getCurrencyAmount(world, playerId, 'scrap')).toBe(75);
    });

    it('removes currency and prunes empty stacks', () => {
      addCurrency(world, playerId, 'scrap', 50);

      expect(removeCurrency(world, playerId, 'scrap', 30)).toBe(true);
      expect(getCurrencyAmount(world, playerId, 'scrap')).toBe(20);

      // Remove remaining 20 -> stack should be purged
      expect(removeCurrency(world, playerId, 'scrap', 20)).toBe(true);
      expect(getCurrencyAmount(world, playerId, 'scrap')).toBe(0);

      const runCurrency = world.getComponent(playerId, RunCurrency);
      expect(runCurrency?.stacks).toHaveLength(0);
    });

    it('rejects removal when amount exceeds balance', () => {
      addCurrency(world, playerId, 'scrap', 10);
      expect(removeCurrency(world, playerId, 'scrap', 50)).toBe(false);
      expect(getCurrencyAmount(world, playerId, 'scrap')).toBe(10);
    });
  });

  describe('Software and Equipment Slot Bounds', () => {
    it('adds software items and auto-assigns sequential gridIndex', () => {
      const sw1 = makeItem(101, 'vampire-v1', 'common');
      const sw2 = makeItem(102, 'auto-loader-v1', 'rare');

      expect(addSoftware(world, playerId, sw1)).toBe(true);
      expect(addSoftware(world, playerId, sw2)).toBe(true);

      const inv = world.getComponent(playerId, RunInventory);
      expect(inv?.software).toHaveLength(2);
      expect(inv?.software[0].gridIndex).toBe(0);
      expect(inv?.software[1].gridIndex).toBe(1);
    });

    it('removes software item by index', () => {
      addSoftware(world, playerId, makeItem(101, 'v1'));
      addSoftware(world, playerId, makeItem(102, 'v2'));

      const removed = removeSoftware(world, playerId, 0);
      expect(removed?.entityId).toBe(101);

      const inv = world.getComponent(playerId, RunInventory);
      expect(inv?.software).toHaveLength(1);
      expect(inv?.software[0].entityId).toBe(102);
    });

    it('rejects adding items when maxSlots capacity is reached', () => {
      world.patchComponent(playerId, RunInventory, { maxSlots: 2 });

      expect(addSoftware(world, playerId, makeItem(1, 'item-1'))).toBe(true);
      expect(addEquipment(world, playerId, makeItem(2, 'item-2'))).toBe(true);

      // 3rd item must be rejected
      expect(addSoftware(world, playerId, makeItem(3, 'item-3'))).toBe(false);
    });
  });

  describe('Consumable Stacking', () => {
    it('stacks consumables of the same templateId up to 10 in a single slot', () => {
      const item = makeItem(201, 'nanite-canister');

      // Add first
      expect(addConsumable(world, playerId, item, 10)).toBe(true);
      let inv = world.getComponent(playerId, RunInventory);
      expect(inv?.equipment).toHaveLength(1);
      expect(inv?.equipment[0].quantity).toBe(1);
      expect(inv?.equipment[0].isConsumable).toBe(true);

      // Add 9 more (total 10)
      for (let i = 2; i <= 10; i++) {
        expect(addConsumable(world, playerId, makeItem(200 + i, 'nanite-canister'), 10)).toBe(true);
      }
      inv = world.getComponent(playerId, RunInventory);
      expect(inv?.equipment).toHaveLength(1);
      expect(inv?.equipment[0].quantity).toBe(10);

      // 11th should create a new stack
      expect(addConsumable(world, playerId, makeItem(211, 'nanite-canister'), 10)).toBe(true);
      inv = world.getComponent(playerId, RunInventory);
      expect(inv?.equipment).toHaveLength(2);
      expect(inv?.equipment[0].quantity).toBe(10);
      expect(inv?.equipment[1].quantity).toBe(1);
    });

    it('consumes from stack, decrementing quantity and removing when empty', () => {
      addConsumable(world, playerId, makeItem(301, 'nanite-canister'), 10);
      addConsumable(world, playerId, makeItem(302, 'nanite-canister'), 10);

      let inv = world.getComponent(playerId, RunInventory);
      expect(inv?.equipment[0].quantity).toBe(2);

      const firstConsumed = consumeConsumable(world, playerId, 0);
      expect(firstConsumed).toBeDefined();
      inv = world.getComponent(playerId, RunInventory);
      expect(inv?.equipment).toHaveLength(1);
      expect(inv?.equipment[0].quantity).toBe(1);

      const secondConsumed = consumeConsumable(world, playerId, 0);
      expect(secondConsumed).toBeDefined();
      inv = world.getComponent(playerId, RunInventory);
      expect(inv?.equipment).toHaveLength(0);
    });
  });
});
