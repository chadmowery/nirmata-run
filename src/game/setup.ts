import { gameStore, GroundItemInfo } from './ui/store';
import { createEngineInstance } from './engine-factory';
import { GameContext, GameSystem } from './types';
import { syncEngineToStore } from './ui/sync-bridge';
import { registerInputBridge } from './input/input-bridge';
import { StateMachine } from '../engine/state-machine/state-machine';
import { StateConfig } from '../engine/state-machine/types';
import { GameState } from './states/types';
import { GAME_TRANSITIONS } from './states/game-states';
import { InputManager } from './input/input-manager';
import {
  GameAction,
  DIRECTIONS,
  DEFAULT_BINDINGS,
  isFirmwareAction,
  getFirmwareSlotIndex,
} from './input/actions';
import { createTargetingManager } from './input/targeting';
import {
  AbilityDef,
  FirmwareSlots,
  Position,
  MoveIntent,
  VentIntent,
  TemplateId,
  RarityTier,
  SoftwareDef,
  EquipmentDef,
  AugmentData,
  Item,
  Dying,
} from '@shared/components';
import { ActionIntent } from '@shared/types';
import { RunMode } from '@shared/run-mode';
import { PlayerProfile } from '@shared/profile';
import { logger } from '@engine/utils/logger';
import { AutoPathfinder } from './debug/auto-pathfind';
import { useDebugStore } from './debug/debug-store';
import { EventOriginContext } from '@engine/utils/event-context';
import { DebugAPI } from './debug/debug-api';

declare global {
  interface Window {
    __DEBUG__?: DebugAPI;
  }
}

export interface GameConfig {
  gridWidth: number;
  gridHeight: number;
  seed?: string;
  shellId?: string;
  runMode?: RunMode;
  profile?: PlayerProfile;
}

import { globalShellRegistry } from './shells/client';

/**
 * Bootstraps the game and engine together.
 */
export function createGame(config: GameConfig & { sessionId?: string }): GameContext {
  const seed = config.seed ?? `run-${Date.now()}`;

  // Fetch shell record for the player
  const shellId = config.shellId || 'vanguard-v1';
  let shellRecord = globalShellRegistry.get(shellId);
  if (!shellRecord) {
    const isKnownArchetype =
      globalShellRegistry.getTemplates().some((t) => t.id === shellId);
    const archetypeId = isKnownArchetype ? shellId : 'vanguard-v1';
    shellRecord = globalShellRegistry.createRecord(shellId, archetypeId);
  }

  const instance = createEngineInstance({
    width: config.gridWidth,
    height: config.gridHeight,
    seed,
    isClient: true,
    shellRecord,
    profile: config.profile,
    sessionId: config.sessionId,
    runMode: config.runMode,
  });

  const { world, grid, eventBus, turnManager, entityFactory, systems, playerId } = instance;
  const inputManager = new InputManager(DEFAULT_BINDINGS);

  const contextBase: Omit<GameContext, 'fsm'> = {
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
    augmentSystem: systems.augment,
    packCoordinatorSystem: systems.packCoordinator,
    tileCorruptionSystem: systems.tileCorruption,
    runEnderSystem: systems.runEnder,
    stabilitySystem: systems.stability,
    floorManagerSystem: systems.floorManager,
    anchorInteractionSystem: systems.anchorInteraction,
    gravediggerSystem: systems.gravedigger,
    rewardDropSystem: systems.rewardDrop,
    tagCleanupSystem: systems.tagCleanup,
    deadZoneSystem: systems.deadZone,
    equipmentSystem: systems.equipment,
    shellStatsSystem: systems.shellStats,
    teleportSystem: systems.teleport,
    softwareSystem: systems.software,
  };

  const stateConfigs: Record<GameState, StateConfig<GameState, GameContext>> = {
    [GameState.Loading]: {},
    [GameState.MainMenu]: {
      onEnter: (ctx) => {
        ctx.inputManager.disable();
        ctx.eventBus.emit('STATE_TRANSITION', { newState: GameState.MainMenu });
      },
    },
    [GameState.Hub]: {
      onEnter: (ctx) => {
        ctx.inputManager.disable();
        ctx.eventBus.emit('STATE_TRANSITION', { newState: GameState.Hub });
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
    GAME_TRANSITIONS,
  );

  const autoPathfinder = new AutoPathfinder(
    async (intent) => {
      inputManager.setRequestPending(true);
      await sendActionToServer(intent);
      inputManager.setRequestPending(false);
    },
    (action) => {
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
    },
  );

  const context: GameContext = {
    ...contextBase,
    fsm,
    autoPathfinder,
  };

  fsm.setContext(context);

  if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
    window.__DEBUG__ = new DebugAPI(context, (intent) => sendActionToServer(intent));
  }

  syncEngineToStore(context);

  // Hook EventBus to Debug Timeline
  eventBus.onAny((type, payload) => {
    useDebugStore.getState().addTimelineEvent(type, payload, EventOriginContext.current);
  });

  const targetingManager = createTargetingManager(eventBus, (slotIndex, targetX, targetY) => {
    handleConfirmedTarget(slotIndex, targetX, targetY);
  });
  inputManager.setTargetingManager(targetingManager);

  registerInputBridge((action) => handlePlayerInput(action as GameAction));

  // Game pause/resume requests (from systems like AnchorInteraction)
  eventBus.on('GAME_PAUSE_REQUESTED', () => {
    if (fsm.getCurrentState() === GameState.Playing) {
      fsm.transition(GameState.Paused);
    }
  });

  eventBus.on('GAME_RESUME_REQUESTED', () => {
    if (fsm.getCurrentState() === GameState.Paused) {
      fsm.transition(GameState.Playing);
    }
  });

  // UI Decision Listeners (Forward to server)
  eventBus.on('STAIRCASE_DECISION_MADE', async (payload) => {
    if (payload.confirmed) {
      inputManager.setRequestPending(true);
      await sendActionToServer({
        type: 'STAIRCASE_DESCEND',
        staircaseId: payload.staircaseId,
        targetFloor: payload.targetFloor,
      });
      inputManager.setRequestPending(false);
    }
  });

  eventBus.on('ANCHOR_DECISION_MADE', async (payload) => {
    if (payload.decision === 'descend') {
      inputManager.setRequestPending(true);
      await sendActionToServer({
        type: 'ANCHOR_DESCEND',
        anchorId: payload.anchorId!,
        cost: payload.descendCost ?? 0,
      });
      inputManager.setRequestPending(false);
    } else if (payload.decision === 'extract') {
      inputManager.setRequestPending(true);
      await sendActionToServer({
        type: 'ANCHOR_EXTRACT',
      });
      inputManager.setRequestPending(false);
    }
  });

  eventBus.on('EQUIP_REQUESTED', async (payload) => {
    const { Shell } = await import('@shared/components/shell');
    const shell = world.getComponent(playerId, Shell);
    const shellId = shell?.archetypeId || 'player-shell-default';

    inputManager.setRequestPending(true);
    await sendActionToServer({
      type: 'EQUIP',
      shellId,
      slotType: payload.slotType,
      itemEntityId: payload.itemEntityId,
    });
    inputManager.setRequestPending(false);
  });

  eventBus.on('UNEQUIP_REQUESTED', async (payload) => {
    inputManager.setRequestPending(true);
    await sendActionToServer({
      type: 'UNEQUIP',
      slotType: payload.slotType,
      slotIndex: payload.slotIndex,
    });
    inputManager.setRequestPending(false);
  });

  eventBus.on('BURN_SOFTWARE_REQUESTED', async (payload) => {
    inputManager.setRequestPending(true);
    await sendActionToServer({
      type: 'BURN_SOFTWARE',
      runInventoryIndex: payload.runInventoryIndex,
      softwareEntityId: payload.softwareEntityId,
      targetSlot: payload.targetSlot,
    });
    inputManager.setRequestPending(false);
  });

  eventBus.on('PURGE_SOFTWARE_REQUESTED', async (payload) => {
    inputManager.setRequestPending(true);
    await sendActionToServer({
      type: 'PURGE_SOFTWARE',
      targetSlot: payload.targetSlot,
    });
    inputManager.setRequestPending(false);
  });

  eventBus.on('BURN_FIRMWARE_REQUESTED', async (payload) => {
    inputManager.setRequestPending(true);
    await sendActionToServer({
      type: 'BURN_FIRMWARE',
      firmwareEntityId: payload.firmwareEntityId,
      slotIndex: payload.slotIndex,
    });
    inputManager.setRequestPending(false);
  });

  eventBus.on('BURN_AUGMENT_REQUESTED', async (payload) => {
    inputManager.setRequestPending(true);
    await sendActionToServer({
      type: 'BURN_AUGMENT',
      augmentEntityId: payload.augmentEntityId,
      slotIndex: payload.slotIndex,
    });
    inputManager.setRequestPending(false);
  });

  async function handleConfirmedTarget(slotIndex: number, targetX: number, targetY: number) {
    if (
      fsm.getCurrentState() === GameState.Playing &&
      turnManager.canAcceptInput() &&
      context.playerId
    ) {
      // Submit action to engine
      // We encode targeting data into the action key for the TurnManager's playerActionHandler
      // though the prediction here calls firmwareSystem directly.
      systems.firmware.activateAbility(context.playerId, slotIndex, targetX, targetY);
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
    if (action === GameAction.TOGGLE_HOTKEYS) {
      gameStore.getState().toggleHotkeysModal();
      return;
    }

    if (action === GameAction.TOGGLE_INVENTORY) {
      gameStore.getState().toggleInventory();
      return;
    }

    if (action === GameAction.TOGGLE_FLAVOR_TEXT) {
      gameStore.getState().toggleDetailedFlavorText();
      const active = gameStore.getState().detailedFlavorTextEnabled;
      gameStore.getState().addMessage(
        active
          ? '[SENSORS] DETAILED FORENSIC TELEMETRY: ACTIVE (Hover over any tile or object for lore)'
          : '[SENSORS] DETAILED FORENSIC TELEMETRY: STANDBY (Interactive entities only)',
        'info',
      );
      return;
    }

    if (action === GameAction.PICKUP_GROUND) {
      if (gameStore.getState().groundTransferVisible) {
        gameStore.getState().closeGroundTransfer();
        return;
      }
      if (!context.playerId) return;
      const playerPos = world.getComponent(context.playerId, Position);
      if (!playerPos) return;

      const nearby: GroundItemInfo[] = [];
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          const tx = playerPos.x + dx;
          const ty = playerPos.y + dy;
          const cellItems = grid.getItemsAt(tx, ty);
          for (const itemId of cellItems) {
            if (!world.entityExists(itemId) || world.hasComponent(itemId, Dying)) {
              grid.removeItem(itemId, tx, ty);
              continue;
            }
            const pos = world.getComponent(itemId, Position);
            if (!pos || pos.x !== tx || pos.y !== ty) {
              grid.removeItem(itemId, tx, ty);
              continue;
            }

            const tmpl = world.getComponent(itemId, TemplateId);
            const rarity = world.getComponent(itemId, RarityTier);
            const sw = world.getComponent(itemId, SoftwareDef);
            const eq = world.getComponent(itemId, EquipmentDef);
            const ability = world.getComponent(itemId, AbilityDef);
            const augment = world.getComponent(itemId, AugmentData);
            const itemComp = world.getComponent(itemId, Item);

            let name = itemComp?.name || tmpl?.id || `Item #${itemId}`;
            let type = 'equipment';
            if (sw) {
              name = sw.name;
              type = 'software';
            } else if (eq) {
              name = eq.name;
              type = eq.slotType;
            } else if (ability) {
              name = ability.name;
              type = 'firmware';
            } else if (augment) {
              name = augment.name;
              type = 'augment';
            }

            let directionLabel = 'CURRENT TILE';
            if (dx !== 0 || dy !== 0) {
              const ns = dy < 0 ? 'N' : dy > 0 ? 'S' : '';
              const ew = dx < 0 ? 'W' : dx > 0 ? 'E' : '';
              directionLabel = `ADJACENT (${ns}${ew})`;
            }

            nearby.push({
              itemId,
              templateId: tmpl?.id || 'unknown',
              name,
              rarityTier: rarity?.tier || 'v1.x',
              type,
              x: tx,
              y: ty,
              isPlayerTile: dx === 0 && dy === 0,
              directionLabel,
            });
          }
        }
      }

      if (nearby.length === 0) {
        eventBus.emit('MESSAGE_EMITTED', {
          text: 'No loot on the ground nearby to pick up.',
          type: 'info',
        });
        return;
      }

      // If only 1 item and it is on the player's current tile, directly pick it up!
      if (nearby.length === 1 && nearby[0].isPlayerTile) {
        inputManager.setRequestPending(true);
        await sendActionToServer({
          type: 'PICKUP',
          itemId: nearby[0].itemId,
          targetX: nearby[0].x,
          targetY: nearby[0].y,
        });
        inputManager.setRequestPending(false);
        return;
      }

      // If multiple items or items on adjacent tiles, open the Ground Transfer Modal!
      gameStore.getState().openGroundTransfer(nearby);
      return;
    }

    if (action === GameAction.PAUSE) {
      if (gameStore.getState().groundTransferVisible) {
        gameStore.getState().closeGroundTransfer();
        return;
      }
      if (gameStore.getState().hotkeysModalVisible) {
        gameStore.getState().setHotkeysModalVisible(false);
        return;
      }
      if (gameStore.getState().inventoryVisible) {
        gameStore.getState().toggleInventory();
        return;
      }
      const currentState = fsm.getCurrentState();
      if (currentState === GameState.Playing) {
        const currentAbort = gameStore.getState().abortDialogVisible;
        if (currentAbort) {
          gameStore.getState().setAbortDialogVisible(false);
        } else {
          gameStore.getState().setAbortDialogVisible(true);
          fsm.transition(GameState.Paused);
        }
      } else if (currentState === GameState.Paused) {
        gameStore.getState().setAbortDialogVisible(false);
        fsm.transition(GameState.Playing);
      }
      return;
    }

    if (action === GameAction.DEBUG_PATHFIND_ANCHOR) {
      autoPathfinder.toggle();
      return;
    }

    if (action === GameAction.DEBUG_TOGGLE_TIMELINE) {
      useDebugStore.getState().toggleTimeline();
      return;
    }

    if (action === GameAction.RECENTER_CAMERA) {
      eventBus.emit('RECENTER_CAMERA', {});
      return;
    }

    autoPathfinder.cancel();

    const pId = context.playerId;
    if (fsm.getCurrentState() === GameState.Playing && turnManager.canAcceptInput() && pId) {
      // Handle Firmware Actions with Targeting
      if (isFirmwareAction(action)) {
        const slotIndex = getFirmwareSlotIndex(action);
        if (slotIndex !== null) {
          const slots = world.getComponent(pId, FirmwareSlots);
          const firmwareId = slots?.equipped[slotIndex];
          if (firmwareId !== undefined) {
            const abilityDef = world.getComponent(firmwareId, AbilityDef);
            if (abilityDef) {
              if (abilityDef.effectType === 'toggle_vision') {
                await handleConfirmedTarget(slotIndex, 0, 0);
              } else {
                const pos = world.getComponent(pId, Position);
                if (pos) {
                  targetingManager.startTargeting(
                    slotIndex,
                    pos.x,
                    pos.y,
                    abilityDef.range || abilityDef.dashDistance,
                    abilityDef.effectType,
                  );
                }
              }
              return;
            }
          }
        }
      }

      inputManager.setRequestPending(true);
      turnManager.submitAction(action);
      await sendActionToServer(getActionIntent(action));
      inputManager.setRequestPending(false);
    }
  }

  async function sendActionToServer(intent: ActionIntent | null) {
    if (!intent) return;
    try {
      logger.info(
        `[CLIENT] Sending action to server. SessionId: ${context.sessionId || 'default-session'}`,
        'NETWORK',
      );
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
        const serverState = result.payload;
        if (serverState) {
          const { applyStateDelta } = await import('@shared/reconciliation');
          // Update playerId before applying delta so that events emitted during sync see the correct ID (D-05 regression)
          context.playerId = serverState.playerId;
          applyStateDelta(world, grid, turnManager, eventBus, serverState);
        }
      } else if (response.status === 404) {
        logger.warn(`[API] Session NOT FOUND: ${context.sessionId || 'default-session'}`, 'API');
      }
    } catch (error) {
      logger.error('Failed to sync with server:', 'NETWORK', error);
    } finally {
      gameStore.getState().clearOptimisticUpdates();
      gameStore.getState().incrementInventoryRevision();
    }
  }

  inputManager.setActionHandler(handlePlayerInput);

  autoPathfinder.setContext(context);

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
      world.addComponent(entityId, MoveIntent, { dx, dy });
    } else if (action === GameAction.VENT) {
      world.addComponent(entityId, VentIntent, {});
    }
    // Note: USE_FIRMWARE is handled via prediction/targeting bridge above
    // but the engine-factory default handler also catches it for safety.

    eventBus.emit('PLAYER_ACTION', { action, entityId });
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
    context.kernelPanicSystem,
    context.augmentSystem,
    context.packCoordinatorSystem,
    context.tileCorruptionSystem,
    context.runEnderSystem,
    context.stabilitySystem,
    context.floorManagerSystem,
    context.anchorInteractionSystem,
    context.gravediggerSystem,
    context.rewardDropSystem,
    context.tagCleanupSystem,
    context.deadZoneSystem,
    context.equipmentSystem,
    context.shellStatsSystem,
    context.teleportSystem,
    context.softwareSystem,
  ];

  for (const sys of systems) {
    sys.dispose?.();
  }

  context.autoPathfinder?.cancel();
  context.inputManager.disable();
  context.eventBus.clear();
}
