import { describe, it, expect, beforeEach, vi } from 'vitest';
import { World } from '@engine/ecs/world';
import { Grid } from '@engine/grid/grid';
import { EventBus } from '@engine/events/event-bus';
import { runActionPipeline } from '../pipeline';
import { runInventoryRegistry } from '../../game/systems/run-inventory';
import { Actor, Position, FloorState } from '../components';
import { GameplayEvents } from '../events/types';

describe('Death Pity and Extraction', () => {
  let world: World<GameplayEvents>;
  let grid: Grid;
  let eventBus: EventBus<GameplayEvents>;
  let sessionId = 'test-session';
  let playerId: number;

  beforeEach(() => {
    eventBus = new EventBus<GameplayEvents>();
    world = new World<GameplayEvents>(eventBus);
    grid = new Grid(10, 10);
    
    playerId = world.createEntity();
    world.addComponent(playerId, Actor, { isPlayer: true });
    world.addComponent(playerId, Position, { x: 5, y: 5 });
    world.addComponent(playerId, FloorState, { currentFloor: 1, maxFloor: 15, runSeed: 'test' });

    runInventoryRegistry.clear(sessionId);
  });

  it('ENTITY_DIED (player) sets inventory Scrap to 25% pity', async () => {
    // Add 100 scrap to inventory
    runInventoryRegistry.addCurrency(sessionId, 'scrap', 100);
    runInventoryRegistry.addCurrency(sessionId, 'flux', 50);

    const { setupInternalHandlers } = await import('../pipeline');
    setupInternalHandlers(world, grid, eventBus, sessionId);
    
    eventBus.emit('ENTITY_DIED', { entityId: playerId, killerId: 999 });
    eventBus.flush();
    
    expect(runInventoryRegistry.getCurrencyAmount(sessionId, 'scrap')).toBe(25);
    expect(runInventoryRegistry.getCurrencyAmount(sessionId, 'flux')).toBe(0);
  });

  it('ANCHOR_EXTRACT transfers scrap and calculates flux bonus', async () => {
    runInventoryRegistry.addCurrency(sessionId, 'scrap', 200);
    runInventoryRegistry.addCurrency(sessionId, 'flux', 10);

    const { setupInternalHandlers } = await import('../pipeline');
    setupInternalHandlers(world, grid, eventBus, sessionId);

    const endSpy = vi.fn();
    eventBus.on('RUN_ENDED', endSpy);

    eventBus.emit('ANCHOR_EXTRACT', {});
    eventBus.flush();

    expect(runInventoryRegistry.getCurrencyAmount(sessionId, 'scrap')).toBe(0);
    
    // Flux bonus for floor 1: 10 (base) + 2 (perFloor) * 1 = 12
    // Total: 10 (initial) + 12 = 22
    expect(endSpy).toHaveBeenCalledWith(expect.objectContaining({
      reason: 'extraction',
      stats: expect.objectContaining({
        scrapExtracted: 200,
        fluxExtracted: 22
      })
    }));
  });
});
