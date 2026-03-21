import { createEngineInstance } from './engine-factory';
import { serializeWorld, serializeGrid } from '@shared/serialization';
import { GameContext } from './types';
import { syncEngineToStore } from './ui/sync-bridge';
import { registerInputBridge } from './input/input-bridge';
import { StateMachine } from '../engine/state-machine/state-machine';
import { StateConfig } from '../engine/state-machine/types';
import { GameState } from './states/types';
import { GAME_TRANSITIONS } from './states/game-states';
import { InputManager } from './input/input-manager';
import { GameAction, DIRECTIONS, DEFAULT_BINDINGS } from './input/actions';
import { GameEvents } from './events/types';

export interface GameConfig {
  gridWidth: number;
  gridHeight: number;
  seed?: string;
}

/**
 * Bootstraps the game and engine together.
 */
export function createGame(config: GameConfig & { sessionId?: string }): GameContext {
  const seed = config.seed ?? `run-${Date.now()}`;
  const instance = createEngineInstance({
    width: config.gridWidth,
    height: config.gridHeight,
    seed,
    isClient: true
  });

  const { world, grid, eventBus, turnManager, entityFactory, systems, playerId } = instance;
  const inputManager = new InputManager(DEFAULT_BINDINGS);

  const context = {
    world,
    grid,
    eventBus,
    turnManager,
    entityFactory,
    playerId,
    inputManager,
    sessionId: config.sessionId,
    currentSeed: seed,
    movementSystem: systems.movement,
    combatSystem: systems.combat,
    aiSystem: systems.ai,
    itemPickupSystem: systems.itemPickup,
  } as GameContext;

  const stateConfigs: Record<GameState, StateConfig<GameState, GameContext>> = {
    [GameState.Loading]: {},
    [GameState.MainMenu]: {
      onEnter: (ctx) => {
        ctx.inputManager.disable();
        ctx.eventBus.emit('STATE_TRANSITION', { newState: GameState.MainMenu });
      },
    },
    [GameState.Playing]: {
      onEnter: (ctx) => {
        console.log('[SETUP] Entering Playing state');
        // Initial setup already handled by createEngineInstance in createGame
        ctx.inputManager.enable();
        ctx.turnManager.start();
        console.log('[SETUP] Input manager enabled and Turn manager started');

        // Emit events for UI sync
        ctx.eventBus.emit('STATE_TRANSITION', { newState: GameState.Playing });
        ctx.eventBus.emit('DUNGEON_GENERATED', { seed: ctx.currentSeed || 'unknown' });
      },
      onExit: (ctx) => {
        ctx.inputManager.disable();
      },
    },
    [GameState.Paused]: {
      onEnter: (ctx) => {
        ctx.inputManager.disable();
        ctx.eventBus.emit('STATE_TRANSITION', { newState: GameState.Paused });
      },
    },
    [GameState.GameOver]: {
      onEnter: (ctx) => {
        ctx.inputManager.disable();
        ctx.eventBus.emit('STATE_TRANSITION', { newState: GameState.GameOver });
      },
    },
  };

  const fsm = new StateMachine<GameState, GameContext>(
    GameState.Loading,
    stateConfigs,
    GAME_TRANSITIONS,
    context
  );

  context.fsm = fsm;

  // Initialize UI Bridge
  syncEngineToStore(context);
  registerInputBridge((action) => turnManager.submitAction(action));

  // Wire input ActionHandler
  inputManager.setActionHandler(async (action: GameAction) => {
    if (action === GameAction.PAUSE) {
      const currentState = fsm.getCurrentState();
      if (currentState === GameState.Playing) {
        fsm.transition(GameState.Paused);
      } else if (currentState === GameState.Paused) {
        fsm.transition(GameState.Playing);
      }
      return;
    }

    if (fsm.getCurrentState() === GameState.Playing && turnManager.canAcceptInput()) {
      // 1. Gating
      inputManager.setRequestPending(true);

      // 2. Snapshot (for reconciliation)
      const baseWorldState = serializeWorld(world);
      const baseGridState = serializeGrid(grid);

      // 3. Prediction
      turnManager.submitAction(action);

      // 4. API Call
      try {
        const intent = getActionIntent(action);
        if (intent) {
          console.log(`[CLIENT] Sending action to server. SessionId: ${context.sessionId || 'default-session'}`);
          const response = await fetch('/api/action', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sessionId: context.sessionId || 'default-session',
              action: intent,
            }),
          });

          if (response.ok) {
            const result = await response.json();
            if (result.delta) {
              const { applyStateDelta } = await import('@shared/reconciliation');
              applyStateDelta(world, grid, eventBus, result.delta, baseWorldState, baseGridState);
            }
          }
        }
      } catch (error) {
        console.error('Failed to sync with server:', error);
      } finally {
        inputManager.setRequestPending(false);
      }
    }
  });

  function getActionIntent(action: GameAction): any {
    if (DIRECTIONS[action]) {
      return { type: 'MOVE', dx: DIRECTIONS[action].dx, dy: DIRECTIONS[action].dy };
    }
    if (action === GameAction.WAIT) {
      return { type: 'WAIT' };
    }
    return null;
  }

  // Wire TurnManager handles
  turnManager.setPlayerActionHandler((action: string, entityId: number) => {
    const gameAction = action as GameAction;
    if (DIRECTIONS[gameAction]) {
      const { dx, dy } = DIRECTIONS[gameAction];
      context.movementSystem.processMove(entityId, dx, dy);
    }

    eventBus.emit('PLAYER_ACTION', { action, entityId });
  });

  // Enemy action handler
  turnManager.setEnemyActionHandler((entityId) => {
    context.aiSystem.processEnemyTurn(entityId);
  });

  return context;
}

/**
 * Cleans up game resources and systems.
 */
export function destroyGame(context: GameContext) {
  (context.combatSystem as any).dispose?.();
  (context.itemPickupSystem as any).dispose?.();
  (context.aiSystem as any).dispose?.();
  (context.movementSystem as any).dispose?.();
  context.inputManager.disable();
  context.eventBus.clear();
}
