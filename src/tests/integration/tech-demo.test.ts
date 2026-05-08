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
      context.world.patchComponent(context.playerId!, Health, { current: 0 });
    }

    // Trigger an event that causes death check if needed, 
    // or just emit the event manually to see if UI reacts
    // Manually emit authoritative RUN_ENDED to bridge client-state in test environment (D-06 bridge)
    context.eventBus.emit('RUN_ENDED', { 
      reason: 'death',
      floorNumber: 1,
      stats: {
        scrapExtracted: 0,
        fluxExtracted: 0,
        softwareExtracted: 0,
        pityAwarded: false,
        itemsExtracted: []
      },
      entityId: context.playerId!
    });
    context.eventBus.flush();

    expect(gameStore.getState().gameStatus).toBe(GameState.GameOver);

    // Cleanup
    destroyGame(context);
  });
});
