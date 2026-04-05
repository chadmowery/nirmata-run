// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createGame } from './setup';
import { GameState } from './states/types';
import { GameAction } from './input/actions';
import * as Components from '@shared/components';
const { Position, Actor, Energy, Hostile } = Components;

describe('Game Setup Integration', () => {
  let context: ReturnType<typeof createGame>;

  beforeEach(() => {
    // Basic config for tests
    context = createGame({ gridWidth: 10, gridHeight: 10 });
    // Mock fetch for action calls
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ payload: { type: 'DELTA', world: {}, grid: {}, events: [], turnNumber: 1 } })
    }));
  });

  it('should initialize with all required modules', () => {
    expect(context.world).toBeDefined();
    expect(context.grid).toBeDefined();
    expect(context.eventBus).toBeDefined();
    expect(context.fsm).toBeDefined();
    expect(context.turnManager).toBeDefined();
    expect(context.inputManager).toBeDefined();
    expect(context.movementSystem).toBeDefined();
  });

  it('should start in Loading state', () => {
    expect(context.fsm.getCurrentState()).toBe(GameState.Loading);
  });

  it('should disable input when transitioning to MainMenu', () => {
    // Transition to MainMenu
    context.fsm.transition(GameState.MainMenu);
    expect(context.fsm.getCurrentState()).toBe(GameState.MainMenu);
    expect(context.inputManager.isEnabled()).toBe(false);
  });

  it('should enable input and start turn manager when transitioning to Playing', () => {
    // Need to go Loading -> MainMenu -> Playing to follow transition table
    context.fsm.transition(GameState.MainMenu);
    context.fsm.transition(GameState.Playing);
    
    expect(context.fsm.getCurrentState()).toBe(GameState.Playing);
    expect(context.inputManager.isEnabled()).toBe(true);
  });

  it('should disable input when pausing', () => {
    context.fsm.transition(GameState.MainMenu);
    context.fsm.transition(GameState.Playing);
    context.fsm.transition(GameState.Paused);
    
    expect(context.fsm.getCurrentState()).toBe(GameState.Paused);
    expect(context.inputManager.isEnabled()).toBe(false);
  });

  it('should process movement through input -> turn manager -> movement system', () => {
    const { world, grid, fsm, turnManager, inputManager } = context;

    // 1. Get player from context
    const player = context.playerId;
    if (player === undefined) throw new Error('Player not found');
    
    // Ensure floor is walkable
    grid.setTile(1, 1, { terrain: 'floor', walkable: true, transparent: true });
    grid.setTile(2, 1, { terrain: 'floor', walkable: true, transparent: true });
    
    const posComp = world.getComponent(player, Position)!;
    posComp.x = 1;
    posComp.y = 1;
    const energyComp = world.getComponent(player, Energy)!;
    energyComp.current = 1000;
    energyComp.speed = 100;
    energyComp.threshold = 1000;
    grid.removeEntity(player, 5, 4); // Remove from default spawn if any
    grid.addEntity(player, 1, 1);

    // 2. Transition to Playing
    fsm.transition(GameState.MainMenu);
    fsm.transition(GameState.Playing);

    // 3. Simulate input action via InputManager (mocking the handler call)
    // Actually we can just get the handler and call it directly
    const actionHandler = (inputManager as any).handler;
    expect(actionHandler).toBeDefined();

    // 4. Submit MOVE_EAST action
    actionHandler(GameAction.MOVE_EAST);

    // 5. Verify movement
    const pos = world.getComponent(player, Position);
    expect(pos?.x).toBe(2);
    expect(pos?.y).toBe(1);
    
    // 6. Verify energy deduction and replenishment (TurnManager auto-advances until ready)
    const energy = world.getComponent(player, Energy);
    expect(energy?.current).toBe(1000);
  });

  it('should handle bump-attack when moving into hostile', () => {
    const { world, grid, fsm, inputManager, eventBus } = context;
    const emitSpy = vi.spyOn(eventBus, 'emit');

    // 1. Get player from context
    const player = context.playerId;
    if (player === undefined) throw new Error('Player not found');

    // Ensure floor is walkable
    grid.setTile(1, 1, { terrain: 'floor', walkable: true, transparent: true });
    grid.setTile(2, 1, { terrain: 'floor', walkable: true, transparent: true });

    const posComp = world.getComponent(player, Position)!;
    posComp.x = 1;
    posComp.y = 1;
    const energyComp = world.getComponent(player, Energy)!;
    energyComp.current = 1000;
    energyComp.speed = 100;
    energyComp.threshold = 1000;
    grid.removeEntity(player, 5, 4); // Remove from default spawn
    grid.addEntity(player, 1, 1);

    // 2. Create hostile enemy
    const enemy = world.createEntity();
    world.addComponent(enemy, Position, { x: 2, y: 1 });
    world.addComponent(enemy, Hostile, {});
    grid.addEntity(enemy, 2, 1);

    // 3. Transition to Playing
    fsm.transition(GameState.MainMenu);
    fsm.transition(GameState.Playing);

    // 4. Submit MOVE_EAST action
    const actionHandler = (inputManager as any).handler;
    actionHandler(GameAction.MOVE_EAST);

    // 5. Verify BUMP_ATTACK event emitted
    expect(emitSpy).toHaveBeenCalledWith('BUMP_ATTACK', {
      attackerId: player,
      defenderId: enemy,
    });

    // 6. Verify player stayed in place
    const pos = world.getComponent(player, Position);
    expect(pos?.x).toBe(1);
  });

  it('should transition to Paused when PAUSE action is received in Playing state', () => {
    context.fsm.transition(GameState.MainMenu);
    context.fsm.transition(GameState.Playing);

    const actionHandler = (context.inputManager as any).handler;
    actionHandler(GameAction.PAUSE);

    expect(context.fsm.getCurrentState()).toBe(GameState.Paused);
    expect(context.inputManager.isEnabled()).toBe(false);
  });

  it('should transition back to Playing when PAUSE action is received in Paused state', () => {
    context.fsm.transition(GameState.MainMenu);
    context.fsm.transition(GameState.Playing);
    context.fsm.transition(GameState.Paused);

    // Since input is disabled in Paused state via FSM hook, we simulate the action handler call directly
    // In a real scenario, the Pause Menu would handle its own input or re-enable it.
    // For now the ActionHandler logic in setup.ts handles PAUSE mapping regardless of canAcceptInput?
    // Wait, let's look at setup.ts:
    // if (action === GameAction.PAUSE) { ... return; }
    // It's outside the turnManager.canAcceptInput() check.
    
    const actionHandler = (context.inputManager as any).handler;
    actionHandler(GameAction.PAUSE);

    expect(context.fsm.getCurrentState()).toBe(GameState.Playing);
    expect(context.inputManager.isEnabled()).toBe(true);
  });
});
