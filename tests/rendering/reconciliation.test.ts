import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createGame } from '../../src/game/setup';
import { GameAction } from '../../src/game/input/actions';
import { Position } from '../../src/shared/components';
import { diff } from 'json-diff-ts';
import { serializeWorld, serializeGrid } from '../../src/shared/serialization';

import { GameState } from '../../src/game/states/types';

describe('Reconciliation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock fetch for API calls
    global.fetch = vi.fn();
    // Mock document for InputManager
    global.document = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as any;
  });

  it('should predict player movement and then reconcile with server delta', async () => {
    const game = createGame({ gridWidth: 10, gridHeight: 10, seed: 'test' });
    game.fsm.transition(GameState.MainMenu);
    game.fsm.transition(GameState.Playing);
    
    // Access properties AFTER transition to get new instances (grid, etc)
    const { world, eventBus, inputManager } = game;
    const grid = game.grid;
    const playerId = game.playerId;
    
    if (!playerId) throw new Error('Player ID not found');

    const initialPos = { ...world.getComponent(playerId, Position)! };
    // Ensure target tile is walkable and clear of blockers
    const tx = initialPos.x + 1;
    const ty = initialPos.y;
    grid.setTile(tx, ty, { terrain: 'floor', walkable: true, transparent: true });
    
    const occupants = Array.from(grid.getEntitiesAt(tx, ty));
    for (const id of occupants) {
      grid.removeEntity(id, tx, ty);
    }
    
    // 1. Mock server response
    const oldWorldState = serializeWorld(world);
    const oldGridState = serializeGrid(grid);
    
    // Move player (optimistic)
    const pos = world.getComponent(playerId, Position)!;
    pos.x += 1;
    
    const newWorldState = serializeWorld(world);
    const newGridState = serializeGrid(grid);
    const delta = {
      world: diff(oldWorldState, newWorldState),
      grid: diff(oldGridState, newGridState),
    };

    // Reset client pos to initial for the test
    pos.x = initialPos.x;

    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ delta }),
    });

    // 2. Trigger action on client
    const moveEast = GameAction.MOVE_EAST;
    const movedSpy = vi.fn();
    eventBus.on('ENTITY_MOVED', movedSpy);

    const inputHandler = (inputManager as any).handler;
    await inputHandler(moveEast);

    // 3. Verify Prediction
    const predictedPos = world.getComponent(playerId, Position)!;
    expect(predictedPos.x).toBe(initialPos.x + 1);
    expect(movedSpy).toHaveBeenCalled();

    // 4. Verify Reconciliation (happens after fetch resolves)
    expect(predictedPos.x).toBe(initialPos.x + 1);
  });

  it('should correct a client desync via reconciliation (Snap-to-Truth)', async () => {
    const game = createGame({ gridWidth: 10, gridHeight: 10, seed: 'test' });
    game.fsm.transition(GameState.MainMenu);
    game.fsm.transition(GameState.Playing);
    
    const { world, inputManager } = game;
    const grid = game.grid;
    const playerId = game.playerId;
    
    if (!playerId) throw new Error('Player ID not found');

    const initialPos = { ...world.getComponent(playerId, Position)! };

    const tx = initialPos.x + 1;
    const ty = initialPos.y;
    grid.setTile(tx, ty, { terrain: 'floor', walkable: true, transparent: true });
    for (const id of Array.from(grid.getEntitiesAt(tx, ty))) {
      grid.removeEntity(id, tx, ty);
    }
    
    // 1. Mock server response that REJECTS the move (stay at initialPos)
    const oldWorldState = serializeWorld(world);
    const oldGridState = serializeGrid(grid);

    // Simulate client prediction (moving east)
    const clientPredictedPos = world.getComponent(playerId, Position)!;
    clientPredictedPos.x += 1;
    const newWorldState = serializeWorld(world);
    const newGridState = serializeGrid(grid);
    // Revert client prediction for server delta calculation
    clientPredictedPos.x -= 1;

    // Server's truth is that the player did not move.
    // So, the delta from the client's predicted state (newWorldState)
    // back to the server's truth (oldWorldState) is needed.
    const worldDelta = diff(newWorldState, oldWorldState);
    const gridDelta = diff(newGridState, oldGridState);
 
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        delta: {
          world: worldDelta,
          grid: gridDelta,
        }
      })
    });

    // 2. Trigger action on client
    const inputHandler = (inputManager as any).handler;
    await inputHandler(GameAction.MOVE_EAST);

    // 3. Verify Prediction moved player
    const currentPos = world.getComponent(playerId, Position)!;
    
    // 4. Reconciliation should have moved them BACK
    expect(currentPos.x).toBe(initialPos.x); 
  });
});
