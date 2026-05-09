import { describe, it, expect, vi } from 'vitest';
import { createEngineInstance } from '../../engine-factory';
import { StaircaseMarker, Position, DescentIntent, ExtractionIntent } from '@shared/components';
import { GameAction } from '../../input/actions';

describe('Interaction Systems', () => {
  const config = {
    width: 20,
    height: 20,
    seed: 'test-seed',
  };

  it('triggers proximity messages when moving onto stairs', async () => {
    const engine = createEngineInstance(config);
    const { world, grid, eventBus, playerId } = engine;

    // Create a staircase at (10, 10)
    const staircaseId = world.createEntity();
    world.addComponent(staircaseId, Position, { x: 10, y: 10 });
    world.addComponent(staircaseId, StaircaseMarker, { targetFloor: 2 });
    grid.addEntity(staircaseId, 10, 10);

    // Position player at (10, 11)
    world.patchComponent(playerId, Position, { x: 10, y: 11 });
    grid.clear();
    grid.addEntity(playerId, 10, 11);
    grid.addEntity(staircaseId, 10, 10);
    grid.setTile(10, 10, { terrain: 'floor', walkable: true, transparent: true });

    const messageSpy = vi.fn();
    eventBus.on('MESSAGE_EMITTED', messageSpy);

    // 1. Move North onto stairs
    engine.turnManager.submitAction(GameAction.MOVE_NORTH);

    // Should show proximity message
    expect(messageSpy).toHaveBeenCalledWith(expect.objectContaining({
      text: expect.stringContaining('Staircase'),
    }));

    // Position should have updated to (10, 10)
    expect(world.getComponent(playerId, Position)!.y).toBe(10);
  });

  it('resolves descent when DescentIntent is added', async () => {
    const engine = createEngineInstance(config);
    const { world, eventBus, playerId } = engine;

    const transitionSpy = vi.fn();
    eventBus.on('FLOOR_TRANSITION', transitionSpy);

    // Manually add DescentIntent (simulating UI confirmation)
    world.addComponent(playerId, DescentIntent, { targetFloor: 2, cost: 0 });

    // Run a turn cycle to process intents
    engine.turnManager.submitAction(GameAction.WAIT);

    expect(transitionSpy).toHaveBeenCalledWith(expect.objectContaining({
      floorNumber: 2
    }));
  });

  it('resolves extraction when ExtractionIntent is added', async () => {
    const engine = createEngineInstance(config);
    const { world, eventBus, playerId } = engine;

    const runEndedSpy = vi.fn();
    eventBus.on('RUN_ENDED', runEndedSpy);

    // Manually add ExtractionIntent
    world.addComponent(playerId, ExtractionIntent, { reason: 'manual' });

    // Run a turn cycle
    engine.turnManager.submitAction(GameAction.WAIT);

    expect(runEndedSpy).toHaveBeenCalledWith(expect.objectContaining({
      reason: 'extraction'
    }));
  });
});
