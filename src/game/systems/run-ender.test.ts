import { describe, it, expect, vi } from 'vitest';
import { World } from '../../engine/ecs/world';
import { Grid } from '../../engine/grid/grid';
import { EventBus } from '../../engine/events/event-bus';
import { createRunEnderSystem } from './run-ender';
import { Actor, Position, FloorState } from '@shared/components';
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
});
