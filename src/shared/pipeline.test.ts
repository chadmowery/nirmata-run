import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '../engine/ecs/world';
import { Grid } from '../engine/grid/grid';
import { EventBus } from '../engine/events/event-bus';
import { GameplayEvents } from './events/types';
import { BurnedSoftware } from './components/burned-software';
import { Actor, Position } from './components';
import { setupInternalHandlers } from './pipeline';
import { RunInventory, RunCurrency } from './components/run-inventory';
import * as InventoryUtil from './utils/inventory-util';

describe('Pipeline - Software Integration', () => {
  let world: World<GameplayEvents>;
  let grid: Grid;
  let eventBus: EventBus<GameplayEvents>;
  const sessionId = 'test-session';

  beforeEach(() => {
    eventBus = new EventBus<GameplayEvents>();
    world = new World<GameplayEvents>(eventBus);
    grid = new Grid(10, 10);
    setupInternalHandlers(world, grid, eventBus);
  });

  describe('Software death clearing', () => {
    it('ENTITY_DIED clears BurnedSoftware component on dead entity', () => {
      const playerId = world.createEntity();
      world.addComponent(playerId, Actor, { isPlayer: true });
      world.addComponent(playerId, BurnedSoftware, { weapon: 101, armor: 102 });

      eventBus.emit('ENTITY_DIED', { entityId: playerId, killerId: 0, isPlayer: true });
      eventBus.flush();

      const burned = world.getComponent(playerId, BurnedSoftware);
      expect(burned?.weapon).toBe(null);
      expect(burned?.armor).toBe(null);
    });

    it('ENTITY_DIED clears RunInventory for player', () => {
      const playerId = world.createEntity();
      world.addComponent(playerId, Actor, { isPlayer: true });
      world.addComponent(playerId, RunInventory, { software: [], maxSlots: 5 });
      world.addComponent(playerId, RunCurrency, { stacks: [] });
      
      const item: any = { entityId: 101, templateId: 'test', rarityTier: 'v0.x', pickedUpAtFloor: 1, pickedUpAtTimestamp: Date.now() };
      InventoryUtil.addSoftware(world, playerId, item);
      expect(world.getComponent(playerId, RunInventory)?.software.length).toBe(1);

      eventBus.emit('ENTITY_DIED', { entityId: playerId, killerId: 0, isPlayer: true });
      eventBus.flush();

      expect(world.getComponent(playerId, RunInventory)?.software.length).toBe(0);
    });
  });
});
