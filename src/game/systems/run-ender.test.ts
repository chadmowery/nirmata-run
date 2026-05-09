import { describe, it, expect, vi } from 'vitest';
import { World } from '../../engine/ecs/world';
import { Grid } from '../../engine/grid/grid';
import { EventBus } from '../../engine/events/event-bus';
import { createRunEnderSystem } from './run-ender';
import { Actor, Position, FloorState, RunInventory, BurnedSoftware } from '@shared/components';
import { GameplayEvents } from '@shared/events/types';

describe('RunEnderSystem', () => {
  it('should emit RUN_ENDED when ANCHOR_EXTRACT is emitted', () => {
    const eventBus = new EventBus<GameplayEvents>();
    const world = new World<GameplayEvents>(eventBus);
    const grid = new Grid(10, 10);
    const system = createRunEnderSystem(world, grid, eventBus);
    system.init();

    const playerId = world.createEntity();
    world.addComponent(playerId, Actor, { isPlayer: true });
    world.addComponent(playerId, Position, { x: 1, y: 1 });
    world.addComponent(playerId, FloorState, { currentFloor: 5, maxFloor: 15, runSeed: 'test' });

    const runEndedSpy = vi.fn();
    eventBus.on('RUN_ENDED', runEndedSpy);

    eventBus.emit('ANCHOR_EXTRACT', {});
    eventBus.flush();

    expect(runEndedSpy).toHaveBeenCalledWith(expect.objectContaining({
      reason: 'extraction',
      entityId: playerId,
      floorNumber: 5
    }));
  });

  it('should clear inventory and burned software on player death', () => {
    const eventBus = new EventBus<GameplayEvents>();
    const world = new World<GameplayEvents>(eventBus);
    const grid = new Grid(10, 10);
    const system = createRunEnderSystem(world, grid, eventBus);
    system.init();

    const playerId = world.createEntity();
    world.addComponent(playerId, Actor, { isPlayer: true });
    world.addComponent(playerId, Position, { x: 1, y: 1 });
    world.addComponent(playerId, RunInventory, { software: [], maxSlots: 5 });
    world.addComponent(playerId, BurnedSoftware, { weapon: 101, armor: 102 });

    // Emit death event
    eventBus.emit('ENTITY_DIED', { entityId: playerId, killerId: 0, isPlayer: true });
    eventBus.flush();

    const burned = world.getComponent(playerId, BurnedSoftware);
    expect(burned?.weapon).toBe(null);
    expect(burned?.armor).toBe(null);
    expect(world.getComponent(playerId, RunInventory)?.software.length).toBe(0);
  });
});
