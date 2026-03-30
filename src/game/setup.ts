import { createEngineInstance } from './engine-factory';
import { serializeWorld } from '@shared/serialization';
import { GameContext, GameSystem } from './types';
import { syncEngineToStore } from './ui/sync-bridge';
import { registerInputBridge } from './input/input-bridge';
import { StateMachine } from '../engine/state-machine/state-machine';
import { StateConfig } from '../engine/state-machine/types';
import { GameState } from './states/types';
import { GAME_TRANSITIONS } from './states/game-states';
import { InputManager } from './input/input-manager';
import { GameAction, DIRECTIONS, DEFAULT_BINDINGS, isFirmwareAction, getFirmwareSlotIndex } from './input/actions';
import { createTargetingManager } from './input/targeting';
import { AbilityDef, FirmwareSlots, Position } from '@shared/components';
import { ActionIntent } from '@shared/types';
import { logger } from '@shared/utils/logger';

export interface GameConfig {
  gridWidth: number;
  gridHeight: number;
  seed?: string;
  shellId?: string;
}

import { globalShellRegistry } from './shells';

/**
 * Bootstraps the game and engine together.
 */
export function createGame(config: GameConfig & { sessionId?: string }): GameContext {
  const seed = config.seed ?? `run-${Date.now()}`;

  // Fetch shell record for the player
  let shellRecord;
  if (config.shellId) {
    shellRecord = globalShellRegistry.get(config.shellId);
    if (!shellRecord) {
      // Create a persistent record if it doesn't exist (simplification for Phase 7)
      shellRecord = globalShellRegistry.createRecord(config.shellId, 'striker-v1');
    }
  } else {
    // Default to signal for testing if none provided
    shellRecord = globalShellRegistry.createRecord('player-shell-default', 'signal-v1');
  }

  const instance = createEngineInstance({
    width: config.gridWidth,
    height: config.gridHeight,
    seed,
    isClient: true,
    shellRecord
  });

  const { world, grid, eventBus, turnManager, entityFactory, systems, playerId } = instance;
  const inputManager = new InputManager(DEFAULT_BINDINGS);

  const contextBase: Omit<GameContext, "fsm"> = {
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
    heatSystem: systems.heat,
    statusEffectSystem: systems.statusEffect,
    firmwareSystem: systems.firmware,
    kernelPanicSystem: systems.kernelPanic,
  };

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
        logger.info('[SETUP] Entering Playing state');
        // Initial setup already handled by createEngineInstance in createGame
        ctx.inputManager.enable();
        ctx.turnManager.start();
        logger.info('[SETUP] Input manager enabled and Turn manager started');

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
    GAME_TRANSITIONS
  );

  const context: GameContext = {
    ...contextBase,
    fsm,
  };

  fsm.setContext(context);

  // Initialize UI Bridge
  syncEngineToStore(context);

  const targetingManager = createTargetingManager(eventBus, (slotIndex, targetX, targetY) => {
    handleConfirmedTarget(slotIndex, targetX, targetY);
  });
  inputManager.setTargetingManager(targetingManager);

  registerInputBridge((action) => handlePlayerInput(action as GameAction));

  async function handleConfirmedTarget(slotIndex: number, targetX: number, targetY: number) {
    if (fsm.getCurrentState() === GameState.Playing && turnManager.canAcceptInput() && playerId) {
      inputManager.setRequestPending(true);
      const baseWorldState = serializeWorld(world);

      // Submit action to engine
      // We encode targeting data into the action key for the TurnManager's playerActionHandler
      // though the prediction here calls firmwareSystem directly.
      systems.firmware.activateAbility(playerId, slotIndex, targetX, targetY);
      turnManager.submitAction(`USE_FIRMWARE_${slotIndex}`);

      await sendActionToServer({
        type: 'USE_FIRMWARE',
        slotIndex,
        targetX,
        targetY,
      });

      inputManager.setRequestPending(false);
    }
  }

  // The shared handler for both Keyboard (InputManager) and UI Buttons (InputBridge)
  async function handlePlayerInput(action: GameAction) {
    if (action === GameAction.PAUSE) {
      const currentState = fsm.getCurrentState();
      if (currentState === GameState.Playing) {
        fsm.transition(GameState.Paused);
      } else if (currentState === GameState.Paused) {
        fsm.transition(GameState.Playing);
      }
      return;
    }

    if (fsm.getCurrentState() === GameState.Playing && turnManager.canAcceptInput() && playerId) {
      // Handle Firmware Actions with Targeting
      if (isFirmwareAction(action)) {
        const slotIndex = getFirmwareSlotIndex(action);
        if (slotIndex !== null) {
          const slots = world.getComponent(playerId, FirmwareSlots);
          const firmwareId = slots?.equipped[slotIndex];
          if (firmwareId !== undefined) {
            const abilityDef = world.getComponent(firmwareId, AbilityDef);
            if (abilityDef) {
              if (abilityDef.effectType === 'toggle_vision') {
                await handleConfirmedTarget(slotIndex, 0, 0);
              } else {
                const pos = world.getComponent(playerId, Position);
                if (pos) {
                  targetingManager.startTargeting(
                    slotIndex,
                    pos.x,
                    pos.y,
                    abilityDef.range || abilityDef.dashDistance,
                    abilityDef.effectType
                  );
                }
              }
              return;
            }
          }
        }
      }

      inputManager.setRequestPending(true);
      const baseWorldState = serializeWorld(world);
      turnManager.submitAction(action);
      await sendActionToServer(getActionIntent(action));
      inputManager.setRequestPending(false);
    }
  }

  async function sendActionToServer(intent: ActionIntent | null) {
    if (!intent) return;
    try {
      logger.info(`[CLIENT] Sending action to server. SessionId: ${context.sessionId || 'default-session'}`);
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
          applyStateDelta(world, grid, eventBus, result.delta, serializeWorld(world));
        }
      }
    } catch (error) {
      logger.error('Failed to sync with server:', error);
    }
  }

  // Wire input ActionHandler for keyboard
  inputManager.setActionHandler(handlePlayerInput);

  function getActionIntent(action: GameAction): ActionIntent | null {
    if (DIRECTIONS[action]) {
      return { type: 'MOVE', dx: DIRECTIONS[action].dx, dy: DIRECTIONS[action].dy };
    }
    if (action === GameAction.WAIT) {
      return { type: 'WAIT' };
    }
    if (action === GameAction.VENT) {
      return { type: 'VENT' };
    }
    return null;
  }

  // Wire TurnManager handles
  turnManager.setPlayerActionHandler((action: string, entityId: number) => {
    const gameAction = action as GameAction;
    if (DIRECTIONS[gameAction]) {
      const { dx, dy } = DIRECTIONS[gameAction];
      context.movementSystem.processMove(entityId, dx, dy);
    } else if (action === GameAction.VENT) {
      context.heatSystem.vent(entityId);
    }
    // Note: USE_FIRMWARE is handled via prediction/targeting bridge above
    // but the engine-factory default handler also catches it for safety.

    eventBus.emit('PLAYER_ACTION', { action, entityId });
  });

  // Enemy action handler
  turnManager.setEnemyActionHandler((entityId: number) => {
    context.aiSystem.processEnemyTurn(entityId);
  });

  return context;
}

/**
 * Cleans up game resources and systems.
 */
export function destroyGame(context: GameContext) {
  const systems: GameSystem[] = [
    context.combatSystem,
    context.itemPickupSystem,
    context.aiSystem,
    context.movementSystem,
    context.heatSystem,
    context.statusEffectSystem,
    context.firmwareSystem,
    context.kernelPanicSystem
  ];

  for (const sys of systems) {
    sys.dispose?.();
  }

  context.inputManager.disable();
  context.eventBus.clear();
}
