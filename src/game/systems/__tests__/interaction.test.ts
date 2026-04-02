import { describe, it, expect, vi } from 'vitest';
import { createEngineInstance } from '../../engine-factory';
import { StaircaseMarker, AnchorMarker, Position } from '@shared/components';
import { GameAction } from '../../input/actions';

describe('Interaction Systems', () => {
  const config = {
    width: 20,
    height: 20,
    seed: 'test-seed',
  };

  it('emits STAIRCASE_INTERACTION and pauses when moving onto stairs', async () => {
    const engine = createEngineInstance(config);
    const { world, grid, eventBus, playerId } = engine;

    // Find and move player to a safe spot next to stairs
    const playerPos = world.getComponent(playerId, Position)!;
    
    // Create a staircase at (10, 10)
    const staircaseId = world.createEntity();
    world.addComponent(staircaseId, Position, { x: 10, y: 10 });
    world.addComponent(staircaseId, StaircaseMarker, { targetFloor: 2 });
    grid.addEntity(staircaseId, 10, 10);

    // Position player at (10, 11)
    playerPos.x = 10;
    playerPos.y = 11;
    grid.clear(); // Clear initial placement for simplicity
    grid.addEntity(playerId, 10, 11);
    grid.addEntity(staircaseId, 10, 10);
    grid.setTile(10, 10, { terrain: 'floor', walkable: true, transparent: true });

    const eventSpy = vi.fn();
    eventBus.on('STAIRCASE_INTERACTION', eventSpy);
    const descendSpy = vi.fn();
    eventBus.on('STAIRCASE_DESCEND_TRIGGERED', descendSpy);
    const pauseSpy = vi.fn();
    eventBus.on('GAME_PAUSE_REQUESTED', pauseSpy);

    // 1. Move North onto stairs
    engine.turnManager.submitAction(GameAction.MOVE_NORTH);
    
    // Should show UI and pause, but NOT descend yet
    expect(eventSpy).toHaveBeenCalled();
    expect(pauseSpy).toHaveBeenCalled();
    expect(descendSpy).not.toHaveBeenCalled();
    expect(world.getComponent(playerId, Position)!.y).toBe(10); // Still at (10,10) on current floor

    // 2. Confirm descent via event
    eventBus.emit('STAIRCASE_DECISION_MADE', {
      confirmed: true,
      targetFloor: 2,
      staircaseId: staircaseId
    });
    eventBus.flush();

    // Now it should trigger descent
    expect(descendSpy).toHaveBeenCalledWith(expect.objectContaining({
      targetFloor: 2
    }));
  });

  it('does NOT trigger local descent on the client', async () => {
    const engine = createEngineInstance({ ...config, isClient: true });
    const { eventBus } = engine;

    const transitionSpy = vi.fn();
    eventBus.on('FLOOR_TRANSITION', transitionSpy);

    // Simulate Receiving STAIRCASE_DESCEND_TRIGGERED from server
    eventBus.emit('STAIRCASE_DESCEND_TRIGGERED', {
      entityId: engine.playerId,
      targetFloor: 2,
      runSeed: 'test-seed'
    });
    eventBus.flush();

    // FloorManager should have ignored it
    expect(transitionSpy).not.toHaveBeenCalled();
  });

  it('emits ANCHOR_INTERACTION with full data when moving onto anchor', async () => {
    const engine = createEngineInstance(config);
    const { world, grid, eventBus, playerId } = engine;

    const playerPos = world.getComponent(playerId, Position)!;
    
    // Create an anchor at (5, 5)
    const anchorId = world.createEntity();
    world.addComponent(anchorId, Position, { x: 5, y: 5 });
    world.addComponent(anchorId, AnchorMarker, { used: false });
    grid.clear();
    grid.addEntity(anchorId, 5, 5);
    grid.setTile(5, 5, { terrain: 'floor', walkable: true, transparent: true });

    // Position player at (5, 6)
    playerPos.x = 5;
    playerPos.y = 6;
    grid.addEntity(playerId, 5, 6);

    const eventSpy = vi.fn();
    eventBus.on('ANCHOR_INTERACTION', eventSpy);

    // Move North onto anchor
    engine.turnManager.submitAction(GameAction.MOVE_NORTH);
    
    expect(eventSpy).toHaveBeenCalledWith(expect.objectContaining({
      entityId: playerId,
      anchorId: anchorId,
      floorNumber: 1,
      stabilityPercent: expect.any(Number),
      inventory: expect.any(Object),
      descendCost: expect.any(Number)
    }));
  });
});
