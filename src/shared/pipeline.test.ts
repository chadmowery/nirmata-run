import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '../engine/ecs/world';
import { Grid } from '../engine/grid/grid';
import { EventBus } from '../engine/events/event-bus';
import { GameplayEvents } from './events/types';
import { BurnedSoftware } from './components/burned-software';
import { Actor, Position } from './components';
import { setupInternalHandlers } from './pipeline';
import { runInventoryRegistry } from '../game/systems/run-inventory';

describe('Pipeline - Software Integration', () => {
  let world: World<GameplayEvents>;
  let grid: Grid;
  let eventBus: EventBus<GameplayEvents>;
  const sessionId = 'test-session';

  beforeEach(() => {
    eventBus = new EventBus<GameplayEvents>();
    world = new World<GameplayEvents>(eventBus);
    grid = new Grid(10, 10);
    runInventoryRegistry.clear(sessionId);
    setupInternalHandlers(world, grid, eventBus, sessionId);
  });

  describe('Software death clearing', () => {
    it('ENTITY_DIED clears BurnedSoftware component on dead entity', () => {
      const playerId = world.createEntity();
      world.addComponent(playerId, Actor, { isPlayer: true });
      world.addComponent(playerId, BurnedSoftware, { weapon: 101, armor: 102 });

      eventBus.emit('ENTITY_DIED', { entityId: playerId, killerId: 0 });
      eventBus.flush();

      const burned = world.getComponent(playerId, BurnedSoftware);
      expect(burned?.weapon).toBe(null);
      expect(burned?.armor).toBe(null);
    });

    it('ENTITY_DIED clears RunInventory for session', () => {
      const playerId = world.createEntity();
      world.addComponent(playerId, Actor, { isPlayer: true });
      
      const item: any = { entityId: 101, templateId: 'test', rarityTier: 'v0.x', pickedUpAtFloor: 1, pickedUpAtTimestamp: Date.now() };
      runInventoryRegistry.addSoftware(sessionId, item);
      expect(runInventoryRegistry.getOrCreate(sessionId).software.length).toBe(1);

      eventBus.emit('ENTITY_DIED', { entityId: playerId, killerId: 0 });
      eventBus.flush();

      expect(runInventoryRegistry.getOrCreate(sessionId).software.length).toBe(0);
    });
  });
});
