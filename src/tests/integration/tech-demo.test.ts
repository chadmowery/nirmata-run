import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createGame, destroyGame } from '../../game/setup';
import { gameStore } from '../../game/ui/store';
import { GameState } from '../../game/states/types';
import { GameAction } from '../../game/input/actions';
import { Health } from '@shared/components/health';

describe('Tech Demo Integration', () => {
  beforeEach(() => {
    // Reset store
    gameStore.setState({
      gameStatus: GameState.MainMenu,
      stats: { turns: 0, kills: 0 },
      messages: [],
    });
  });

  it('should flow from MainMenu to Playing to GameOver', async () => {
    const config = {
      gridWidth: 20,
      gridHeight: 20,
      seed: 'test-seed'
    };

    // 1. Initial state
    expect(gameStore.getState().gameStatus).toBe(GameState.MainMenu);

    // 2. Start Game
    const context = createGame(config);
    context.fsm.transition(GameState.Playing);
    context.eventBus.flush();
    
    expect(gameStore.getState().gameStatus).toBe(GameState.Playing);
    expect(context.playerId).toBeDefined();

    // 3. Take a turn (Wait)
    const initialTurn = gameStore.getState().stats.turns;
    context.turnManager.submitAction(GameAction.WAIT);
    expect(gameStore.getState().stats.turns).toBeGreaterThan(initialTurn);

    // 4. Simulate Player Death
    const playerHealth = context.world.getComponent(context.playerId!, Health);
    if (playerHealth) {
      playerHealth.current = 0;
      context.world.addComponent(context.playerId!, Health, { ...playerHealth });
    }

    // Trigger an event that causes death check if needed, 
    // or just emit the event manually to see if UI reacts
    context.eventBus.emit('ENTITY_DIED', { 
      entityId: context.playerId!, 
      killerId: 999 
    });
    context.eventBus.flush();

    expect(gameStore.getState().gameStatus).toBe(GameState.GameOver);

    // Cleanup
    destroyGame(context);
  });
});
