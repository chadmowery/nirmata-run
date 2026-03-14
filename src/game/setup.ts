import { World } from '../engine/ecs/world';
import { Grid } from '../engine/grid/grid';
import { EventBus } from '../engine/events/event-bus';
import { EngineEvents } from '../engine/events/types';
import { StateMachine } from '../engine/state-machine/state-machine';
import { StateConfig } from '../engine/state-machine/types';
import { TurnManager } from '../engine/turn/turn-manager';
import { InputManager } from './input/input-manager';
import { MovementSystem, createMovementSystem } from './systems/movement';
import { GameAction, DIRECTIONS, DEFAULT_BINDINGS } from './input/actions';
import { GameEvents } from './events/types';
import { GameState } from './states/types';
import { GAME_TRANSITIONS } from './states/game-states';

import { GameContext } from './types';

export interface GameConfig {
  gridWidth: number;
  gridHeight: number;
}

/**
 * Bootstraps the game and engine together.
 */
export function createGame(config: GameConfig): GameContext {
  const eventBus = new EventBus<GameEvents>();
  const world = new World(eventBus as any);
  const grid = new Grid(config.gridWidth, config.gridHeight);
  const movementSystem = createMovementSystem(world, grid, eventBus);

  const turnManager = new TurnManager(world, eventBus as any, {
    energyThreshold: 1000,
    defaultActionCost: 1000,
    waitActionCost: 500,
  });

  const inputManager = new InputManager(DEFAULT_BINDINGS);

  // Partial context to break circular dependency during initialization
  const context = {
    world,
    grid,
    eventBus,
    movementSystem,
    turnManager,
    inputManager,
  } as GameContext;

  const stateConfigs: Record<GameState, StateConfig<GameState, GameContext>> = {
    [GameState.Loading]: {},
    [GameState.MainMenu]: {
      onEnter: (ctx) => {
        ctx.inputManager.disable();
      },
    },
    [GameState.Playing]: {
      onEnter: (ctx) => {
        ctx.inputManager.enable();
        ctx.turnManager.start();
      },
      onExit: (ctx) => {
        ctx.inputManager.disable();
      },
    },
    [GameState.Paused]: {
      onEnter: (ctx) => {
        ctx.inputManager.disable();
      },
    },
    [GameState.GameOver]: {
      onEnter: (ctx) => {
        ctx.inputManager.disable();
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

  // Wire input ActionHandler
  inputManager.setActionHandler((action: GameAction) => {
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
      turnManager.submitAction(action);
    }
  });

  // Wire TurnManager handles
  turnManager.setPlayerActionHandler((action: string, entityId: number) => {
    const gameAction = action as GameAction;
    if (DIRECTIONS[gameAction]) {
      const { dx, dy } = DIRECTIONS[gameAction];
      movementSystem.processMove(entityId, dx, dy);
    }
    
    eventBus.emit('PLAYER_ACTION', { action, entityId });
  });

  // Default enemy action handler (Phase 4 AI will replace this)
  turnManager.setEnemyActionHandler(() => {
    // No-op for now
  });

  return context;
}
