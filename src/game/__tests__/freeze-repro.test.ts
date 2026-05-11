import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createEngineInstance } from '../engine-factory';
import { GameAction } from '../input/actions';
import { RunMode } from '@shared/run-mode';
import { EventOriginContext } from '@engine/utils/event-context';

describe('Engine Freeze Reproduction', () => {
  beforeEach(() => {
    EventOriginContext.current = 'client';
  });

  it('should not freeze or deplete health on first move', () => {
    const engine = createEngineInstance({
      width: 80,
      height: 45,
      seed: 'test-seed',
      isClient: true,
      runMode: RunMode.SIMULATION
    });

    const healthComp = engine.world.getComponent(engine.playerId, { key: 'health' } as any) as any;
    const initialHealth = healthComp?.current;
    expect(initialHealth).toBeGreaterThan(0);

    // Simulate first move
    engine.turnManager.submitAction(GameAction.MOVE_NORTH);
    
    const healthAfterMoveComp = engine.world.getComponent(engine.playerId, { key: 'health' } as any) as any;
    const healthAfterMove = healthAfterMoveComp?.current;
    
    console.log('Initial Health:', initialHealth);
    console.log('Health after move:', healthAfterMove);
    
    expect(healthAfterMove).toBe(initialHealth);
  });

  it('should emit MESSAGE_EMITTED when player steps on a staircase', () => {
    const engine = createEngineInstance({
      width: 80,
      height: 45,
      seed: 'test-seed-stairs',
      isClient: true,
      runMode: RunMode.SIMULATION
    });

    const { world, grid, eventBus, playerId } = engine;
    const pos = world.getComponent(playerId, { key: 'position' } as any) as any;
    expect(pos).toBeDefined();

    // Create a staircase just north of the player
    const staircaseId = world.createEntity();
    world.addComponent(staircaseId, { key: 'staircaseMarker' } as any, { targetFloor: 2 });
    world.addComponent(staircaseId, { key: 'position' } as any, { x: pos.x, y: pos.y - 1 });
    grid.addEntity(staircaseId, pos.x, pos.y - 1);

    const messageSpy = vi.fn();
    eventBus.on('MESSAGE_EMITTED', messageSpy);

    // Act: Move North onto the staircase
    engine.turnManager.submitAction(GameAction.MOVE_NORTH);

    // Assert: MESSAGE_EMITTED should have been called with staircase text
    expect(messageSpy).toHaveBeenCalledWith(expect.objectContaining({
      text: expect.stringContaining('Staircase'),
    }));
  });
});
