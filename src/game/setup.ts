import { gameStore, GroundItemInfo } from './ui/store';
import { actionRingBuffer, useReportStore } from '@/client/reports';
import { createEngineInstance, EngineInstance } from './engine-factory';
import { createClientEngine, ClientEngineInstance } from '@client/game/client-engine-factory';
import { applyStateDelta } from '@shared/reconciliation';
import { GameContext, GameSystem } from './types';
import { syncEngineToStore } from './ui/sync-bridge';
import { registerInputBridge } from './input/input-bridge';
import { StateMachine } from '../engine/state-machine/state-machine';
import { StateConfig } from '../engine/state-machine/types';
import { GameState } from './states/types';
import { GAME_TRANSITIONS } from './states/game-states';
import { GameEvents } from './events/types';
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
  Prop,
  SecurityLock,
  CorruptedNode,
  AnchorMarker,
  StaircaseMarker,
  FloorState,
  Stability,
  RunInventory,
  AugmentSlots,
  SoftwareDef as SoftwareDefComp,
} from '@shared/components';
import { getCurrencyAmount } from '@shared/utils/inventory-util';
import { ActionIntent, FullSyncPayload } from '@shared/types';
import { RunMode } from '@shared/run-mode';
import { PlayerProfile } from '@shared/profile';
import { DEFAULT_SHELL_ID } from '@shared/constants';
import { logger } from '@engine/utils/logger';
import { EventOriginContext } from '@engine/utils/event-context';

export { setActiveGameContext, getActiveGameContext } from './active-context';
import { setActiveGameContext, getActiveGameContext } from './active-context';

export interface TurnTelemetryData {
  turnNumber: number;
  actionType: string;
  clientPredictionMs: number;
  networkRttMs: number;
  serverTurnMs: number;
  serverPhaseTimings: Record<string, number>;
  serverTopSystems: Array<{ name: string; phase: string; durationMs: number }>;
  enemyTurnsProcessed?: number;
  energySubTicks?: number;
  reconcileMs: number;
  syncType: 'FULL' | 'DELTA';
  payloadBytes: number;
  deltaEntitiesAdded: number;
  deltaEntitiesRemoved: number;
  deltaComponentsSet: number;
  deltaComponentsRemoved: number;
  deltaEventsCount: number;
}

export type TurnTelemetryHook = (data: TurnTelemetryData) => void;

let turnTelemetryHook: TurnTelemetryHook | null = null;

export function setTurnTelemetryHook(hook: TurnTelemetryHook | null): void {
  turnTelemetryHook = hook;
}

/**
 * Resolves a human-readable, semantic action name (e.g. ATTACK, SEARCH, PICKUP)
 * based on the intent sent to the server and the authoritative simulation events returned.
 */
export function deriveSemanticAction(
  intent: ActionIntent | null,
  serverEvents?: Array<{ type: string; payload?: unknown }> | null,
  playerId?: number | null,
): string {
  if (!intent) return 'IDLE';

  if (intent.type === 'WAIT') return 'WAIT';
  if (intent.type === 'VENT') return 'VENT';
  if (intent.type === 'USE_FIRMWARE') return 'FIRMWARE';
  if (intent.type === 'INTERACT_PROP') return 'SEARCH';
  if (intent.type === 'STAIRCASE_DESCEND' || intent.type === 'ANCHOR_DESCEND') return 'DESCEND';
  if (intent.type === 'ANCHOR_EXTRACT') return 'EXTRACT';
  if (intent.type === 'EQUIP') return 'EQUIP';
  if (intent.type === 'UNEQUIP') return 'UNEQUIP';
  if (intent.type === 'BURN_SOFTWARE') return 'BURN_SW';
  if (intent.type === 'PURGE_SOFTWARE') return 'PURGE_SW';
  if (intent.type === 'BURN_FIRMWARE') return 'BURN_FW';
  if (intent.type === 'BURN_AUGMENT') return 'BURN_AUG';

  if (intent.type === 'MOVE') {
    if (serverEvents && serverEvents.length > 0) {
      // 1. Check for player combat damage dealt (Attack)
      const hasAttack = serverEvents.some((e) => {
        if (e.type !== 'DAMAGE_DEALT') return false;
        const payload = e.payload as { attackerId?: number } | undefined;
        return playerId == null || payload?.attackerId === playerId;
      });
      if (hasAttack) return 'ATTACK';

      // 2. Check for prop interaction / lock unlocked (Search)
      const hasSearch = serverEvents.some((e) => {
        if (
          e.type !== 'PROP_INTERACTED' &&
          e.type !== 'LOCK_UNLOCKED' &&
          e.type !== 'DEAD_DROP_TRANSMITTED'
        ) {
          return false;
        }
        const payload = e.payload as { entityId?: number } | undefined;
        return playerId == null || payload?.entityId === playerId;
      });
      if (hasSearch) return 'SEARCH';

      // 3. Check for item or currency pickup
      const hasPickup = serverEvents.some((e) => {
        if (e.type !== 'ITEM_PICKED_UP' && e.type !== 'CURRENCY_PICKED_UP') return false;
        const payload = e.payload as { entityId?: number } | undefined;
        return playerId == null || payload?.entityId === playerId;
      });
      if (hasPickup) return 'PICKUP';

      // 4. Check for floor descent / staircase interaction
      const hasDescend = serverEvents.some(
        (e) => e.type === 'FLOOR_TRANSITION' || e.type === 'STAIRCASE_INTERACTION',
      );
      if (hasDescend) return 'DESCEND';

      // 5. Check for entity move confirmation
      const hasMoved = serverEvents.some((e) => {
        if (e.type !== 'ENTITY_MOVED') return false;
        const payload = e.payload as { entityId?: number } | undefined;
        return playerId == null || payload?.entityId === playerId;
      });
      if (hasMoved) return 'MOVE';
    }

    return 'MOVE';
  }

  return intent.type;
}

/**
 * Canonically resolves the active client sessionId with a consistent fallback chain.
 */
export function resolveActiveSessionId(explicitSessionId?: string): string {
  const storeState = gameStore.getState();
  const activeCtxSessionId = getActiveGameContext()?.sessionId;
  const storedSessionId =
    typeof window !== 'undefined' ? window.localStorage?.getItem('nimrata_sessionId') : null;
  return (
    explicitSessionId ||
    activeCtxSessionId ||
    storeState.launchConfig?.sessionId ||
    storedSessionId ||
    storeState.playerProfile?.sessionId ||
    'default-session'
  );
}



export interface GameConfig {
  gridWidth: number;
  gridHeight: number;
  seed?: string;
  shellId?: string;
  runMode?: RunMode;
  profile?: PlayerProfile;
  initialState?: FullSyncPayload;
}

import { globalShellRegistry } from './shells/client';

/**
 * Bootstraps the game and engine together.
 */
export function createGame(config: GameConfig & { sessionId?: string }): GameContext {
  const seed = config.seed ?? `run-${Date.now()}`;

  let instance: ClientEngineInstance | EngineInstance<GameEvents>;

  if (config.initialState) {
    const clientInstance = createClientEngine({
      width: config.gridWidth,
      height: config.gridHeight,
      sessionId: config.sessionId,
      playerId: config.initialState.playerId,
    });
    applyStateDelta(
      clientInstance.world,
      clientInstance.grid,
      clientInstance.turnManager,
      clientInstance.eventBus,
      config.initialState,
    );
    instance = clientInstance;
  } else {
    // Fetch shell record for the player (legacy/test fallback)
    const shellId = config.shellId || DEFAULT_SHELL_ID;
    let shellRecord = globalShellRegistry.get(shellId);
    if (!shellRecord) {
      const isKnownArchetype =
        globalShellRegistry.getTemplates().some((t) => t.id === shellId);
      const archetypeId = isKnownArchetype ? shellId : DEFAULT_SHELL_ID;
      shellRecord = globalShellRegistry.createRecord(shellId, archetypeId);
    }

    instance = createEngineInstance({
      width: config.gridWidth,
      height: config.gridHeight,
      seed,
      isClient: true,
      shellRecord,
      profile: config.profile,
      sessionId: config.sessionId,
      runMode: config.runMode,
    });
  }

  const { world, grid, eventBus, turnManager, systems } = instance;
  const playerId = config.initialState?.playerId ?? instance.playerId;
  const inputManager = new InputManager(DEFAULT_BINDINGS);

  // Flush queued buffered inputs on bump safeguards and security faults
  eventBus.on('INPUT_BUFFER_CLEARED', () => {
    logger.info('[INPUT] Input buffer flushed by safeguard', 'INPUT');
    inputManager.clearQueue();
  });

  const contextBase: Omit<GameContext, 'fsm'> = {
    world,
    grid,
    eventBus,
    turnManager,
    playerId,
    inputManager,
    sessionId: config.sessionId,
    currentSeed: seed,
    movementSystem: systems?.movement,
    systems: systems as unknown as Record<string, GameSystem>,
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

  const context: GameContext = {
    ...contextBase,
    fsm,
    submitAction: async (intent: ActionIntent) => {
      inputManager.setRequestPending(true);
      const tPredict0 = performance.now();
      try {
        await sendActionToServer(intent, performance.now() - tPredict0);
      } finally {
        inputManager.setRequestPending(false);
      }
    },
  };

  fsm.setContext(context);
  setActiveGameContext(context);

  if (process.env.NODE_ENV === 'development') {
    if (typeof window !== 'undefined') {
      import('@dev-tool/debug/debug-api').then(({ DebugAPI }) => {
        (window as unknown as { __DEBUG__?: unknown }).__DEBUG__ = new DebugAPI(context, (intent) => sendActionToServer(intent));
      });
    }

    import('@dev-tool/debug/debug-store').then(({ useDebugStore }) => {
      eventBus.onAny((type, payload) => {
        useDebugStore.getState().addTimelineEvent(type, payload, EventOriginContext.current);
      });
    });
  }

  syncEngineToStore(context);

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
      const tPredict0 = performance.now();
      await sendActionToServer(
        {
          type: 'STAIRCASE_DESCEND',
          staircaseId: payload.staircaseId,
          targetFloor: payload.targetFloor,
        },
        performance.now() - tPredict0,
      );
      inputManager.setRequestPending(false);
    }
  });

  eventBus.on('ANCHOR_DECISION_MADE', async (payload) => {
    if (payload.decision === 'descend') {
      inputManager.setRequestPending(true);
      const tPredict0 = performance.now();
      await sendActionToServer(
        {
          type: 'ANCHOR_DESCEND',
          anchorId: payload.anchorId!,
          cost: payload.descendCost ?? 0,
        },
        performance.now() - tPredict0,
      );
      inputManager.setRequestPending(false);
    } else if (payload.decision === 'extract') {
      inputManager.setRequestPending(true);
      const tPredict0 = performance.now();
      await sendActionToServer(
        {
          type: 'ANCHOR_EXTRACT',
        },
        performance.now() - tPredict0,
      );
      inputManager.setRequestPending(false);
    }
  });

  eventBus.on('EQUIP_REQUESTED', async (payload) => {
    const { Shell } = await import('@shared/components/shell');
    const shell = world.getComponent(playerId, Shell);
    const shellId = shell?.archetypeId || DEFAULT_SHELL_ID;

    inputManager.setRequestPending(true);
    const tPredict0 = performance.now();
    await sendActionToServer(
      {
        type: 'EQUIP',
        shellId,
        slotType: payload.slotType,
        itemEntityId: payload.itemEntityId,
      },
      performance.now() - tPredict0,
    );
    inputManager.setRequestPending(false);
  });

  eventBus.on('UNEQUIP_REQUESTED', async (payload) => {
    inputManager.setRequestPending(true);
    const tPredict0 = performance.now();
    await sendActionToServer(
      {
        type: 'UNEQUIP',
        slotType: payload.slotType,
        slotIndex: payload.slotIndex,
      },
      performance.now() - tPredict0,
    );
    inputManager.setRequestPending(false);
  });

  eventBus.on('BURN_SOFTWARE_REQUESTED', async (payload) => {
    inputManager.setRequestPending(true);
    const tPredict0 = performance.now();
    await sendActionToServer(
      {
        type: 'BURN_SOFTWARE',
        runInventoryIndex: payload.runInventoryIndex,
        softwareEntityId: payload.softwareEntityId,
        targetSlot: payload.targetSlot,
      },
      performance.now() - tPredict0,
    );
    inputManager.setRequestPending(false);
  });

  eventBus.on('PURGE_SOFTWARE_REQUESTED', async (payload) => {
    inputManager.setRequestPending(true);
    const tPredict0 = performance.now();
    await sendActionToServer(
      {
        type: 'PURGE_SOFTWARE',
        targetSlot: payload.targetSlot,
      },
      performance.now() - tPredict0,
    );
    inputManager.setRequestPending(false);
  });

  eventBus.on('BURN_FIRMWARE_REQUESTED', async (payload) => {
    inputManager.setRequestPending(true);
    const tPredict0 = performance.now();
    await sendActionToServer(
      {
        type: 'BURN_FIRMWARE',
        firmwareEntityId: payload.firmwareEntityId,
        slotIndex: payload.slotIndex,
      },
      performance.now() - tPredict0,
    );
    inputManager.setRequestPending(false);
  });

  eventBus.on('BURN_AUGMENT_REQUESTED', async (payload) => {
    inputManager.setRequestPending(true);
    const tPredict0 = performance.now();
    await sendActionToServer(
      {
        type: 'BURN_AUGMENT',
        augmentEntityId: payload.augmentEntityId,
        slotIndex: payload.slotIndex,
      },
      performance.now() - tPredict0,
    );
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
      const tPredict0 = performance.now();
      systems.firmware.activateAbility(context.playerId, slotIndex, targetX, targetY);
      turnManager.submitAction(`USE_FIRMWARE_${slotIndex}`);
      const clientPredictionMs = performance.now() - tPredict0;

      await sendActionToServer(
        {
          type: 'USE_FIRMWARE',
          slotIndex,
          targetX,
          targetY,
        },
        clientPredictionMs,
      );

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
              continue;
            }
            const pos = world.getComponent(itemId, Position);
            if (!pos || pos.x !== tx || pos.y !== ty) {
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
        const tPredict0 = performance.now();
        await sendActionToServer(
          {
            type: 'PICKUP',
            itemId: nearby[0].itemId,
            targetX: nearby[0].x,
            targetY: nearby[0].y,
          },
          performance.now() - tPredict0,
        );
        inputManager.setRequestPending(false);
        return;
      }

      // If multiple items or items on adjacent tiles, open the Ground Transfer Modal!
      gameStore.getState().openGroundTransfer(nearby);
      return;
    }

    if (action === GameAction.PAUSE) {
      if (gameStore.getState().deadDropModalVisible) {
        gameStore.getState().closeDeadDropModal();
        return;
      }
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
      if (!context.autoPathfinder) {
        import('@dev-tool/debug/auto-pathfind').then(({ AutoPathfinder }) => {
          const autoPathfinder = new AutoPathfinder(
            async (intent) => {
              inputManager.setRequestPending(true);
              await sendActionToServer(intent);
              inputManager.setRequestPending(false);
            },
            (act) => {
              if (DIRECTIONS[act]) {
                return { type: 'MOVE', dx: DIRECTIONS[act].dx, dy: DIRECTIONS[act].dy };
              }
              if (act === GameAction.WAIT) return { type: 'WAIT' };
              if (act === GameAction.VENT) return { type: 'VENT' };
              return null;
            },
          );
          autoPathfinder.setContext(context);
          context.autoPathfinder = autoPathfinder;
          autoPathfinder.toggle();
        });
      } else {
        context.autoPathfinder.toggle();
      }
      return;
    }

    if (action === GameAction.DEBUG_TOGGLE_TIMELINE) {
      if (process.env.NODE_ENV === 'development') {
        import('@dev-tool/debug/debug-store').then(({ useDebugStore }) => {
          useDebugStore.getState().toggleTimeline();
        });
      }
      return;
    }

    if (action === GameAction.RECENTER_CAMERA) {
      eventBus.emit('RECENTER_CAMERA', {});
      return;
    }

    context.autoPathfinder?.cancel();

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

      if (action === GameAction.INTERACT_STAIRCASE) {
        const playerPos = world.getComponent(pId, Position);
        if (playerPos) {
          const currentOccupants = grid.getEntitiesAt(playerPos.x, playerPos.y);
          for (const eid of currentOccupants) {
            const stairs = world.getComponent(eid, StaircaseMarker);
            if (stairs) {
              const floorState = world.getComponent(pId, FloorState);
              const nextFloor = stairs.targetFloor || (floorState?.currentFloor ?? 1) + 1;
              gameStore.getState().showStaircaseOverlay({
                targetFloor: nextFloor,
                staircaseId: eid,
              });
              return;
            }
          }
        }
      }

      if (action === GameAction.INTERACT_ANCHOR) {
        const playerPos = world.getComponent(pId, Position);
        if (playerPos) {
          // 1. Check if the player is standing on an active Stability Anchor first
          const currentOccupants = grid.getEntitiesAt(playerPos.x, playerPos.y);
          let activeAnchorId: number | null = null;
          for (const eid of currentOccupants) {
            const anchor = world.getComponent(eid, AnchorMarker);
            if (anchor && !anchor.used) {
              activeAnchorId = eid;
              break;
            }
          }

          if (activeAnchorId !== null) {
            const floorState = world.getComponent(pId, FloorState);
            const stability = world.getComponent(pId, Stability);
            const fSlots = world.getComponent(pId, FirmwareSlots);
            const aSlots = world.getComponent(pId, AugmentSlots);
            const inventory = world.getComponent(pId, RunInventory);
            const currentFloor = floorState?.currentFloor ?? 1;
            const stabilityVal = stability?.current ?? 0;
            const stabilityMax = stability?.max ?? 100;
            const stabilityPercent = (stabilityVal / stabilityMax) * 100;
            const firmware = (fSlots?.equipped || []).map(
              (id) => world.getComponent(id, AbilityDef)?.name || 'Unknown',
            );
            const augments = (aSlots?.equipped || []).map(
              (id) => world.getComponent(id, AugmentData)?.name || 'Unknown',
            );
            const software = (inventory?.software || []).map((item) => {
              const def = world.getComponent(item.entityId, SoftwareDefComp);
              return def?.name || 'Unknown';
            });
            const scrap = getCurrencyAmount(world, pId, 'scrap');
            const descendCost = 20 + currentFloor * 5;
            const estimatedStabilityAfterDescent = Math.min(100, Math.round(stabilityPercent + 40));

            gameStore.getState().showAnchorOverlay({
              floorNumber: currentFloor,
              stabilityPercent,
              inventory: { firmware, augments, software, scrap },
              descendCost,
              nextFloorEnemyTier: 'Standard',
              estimatedStabilityAfterDescent,
              anchorId: activeAnchorId,
            });
            return;
          }

          const offsets = [
            [0, 0],
            [0, -1],
            [0, 1],
            [-1, 0],
            [1, 0],
          ];
          let targetPropId: number | null = null;
          for (const [dx, dy] of offsets) {
            const entities = grid.getEntitiesAt(playerPos.x + dx, playerPos.y + dy);
            for (const eid of entities) {
              const prop = world.getComponent(eid, Prop);
              if (!prop) continue;
              const lock = world.getComponent(eid, SecurityLock);
              const corrupted = world.getComponent(eid, CorruptedNode);
              if (
                lock?.isLocked ||
                (corrupted && !corrupted.isDisarmed && !corrupted.triggered) ||
                !prop.isSearched
              ) {
                targetPropId = eid;
                break;
              }
            }
            if (targetPropId !== null) break;
          }
          if (targetPropId !== null) {
            const targetProp = world.getComponent(targetPropId, Prop);
            const targetLock = world.getComponent(targetPropId, SecurityLock);
            const targetCorrupted = world.getComponent(targetPropId, CorruptedNode);
            const isUntrappedDeadDrop =
              targetProp?.propClass === 'dead_drop_uplink' &&
              !targetProp.isSearched &&
              !targetLock?.isLocked &&
              (!targetCorrupted || targetCorrupted.isDisarmed || targetCorrupted.triggered);

            if (isUntrappedDeadDrop) {
              gameStore
                .getState()
                .openDeadDropModal(targetPropId, targetProp.deadDropFluxCost ?? 25);
              return;
            }

            inputManager.setRequestPending(true);
            const tPredict0 = performance.now();
            await sendActionToServer(
              {
                type: 'INTERACT_PROP',
                targetPropId,
                forceOverride: true,
              },
              performance.now() - tPredict0,
            );
            inputManager.setRequestPending(false);
            return;
          }
        }
      }

      inputManager.setRequestPending(true);
      const tPredict0 = performance.now();
      turnManager.submitAction(action);
      const clientPredictionMs = performance.now() - tPredict0;
      await sendActionToServer(getActionIntent(action), clientPredictionMs);
      inputManager.setRequestPending(false);
    }
  }

  async function sendActionToServer(intent: ActionIntent | null, clientPredictionMs = 0) {
    if (!intent) return;
    actionRingBuffer.push({ t: Date.now(), type: intent.type });
    const activeSessionId = resolveActiveSessionId(context.sessionId);
    try {
      logger.info(
        `[CLIENT] Sending action to server. SessionId: ${activeSessionId}`,
        'NETWORK',
      );
      const tFetch0 = performance.now();
      const response = await fetch('/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: activeSessionId,
          action: intent,
        }),
      });
      const networkRttMs = performance.now() - tFetch0;

      if (response.ok) {
        const result = await response.json();
        if (result.crashReport) {
          useReportStore.getState().queueServerCrash(result.crashReport, activeSessionId);
        }
        const serverState = result.payload;
        if (serverState) {
          const { applyStateDelta } = await import('@shared/reconciliation');
          // Update playerId before applying delta so that events emitted during sync see the correct ID (D-05 regression)
          context.playerId = serverState.playerId;
          const tReconcile0 = performance.now();
          applyStateDelta(world, grid, turnManager, eventBus, serverState);
          const reconcileMs = performance.now() - tReconcile0;

          if (turnTelemetryHook) {
            const devPerf = result._devPerf;
            const actionType = deriveSemanticAction(
              intent,
              serverState.events,
              context.playerId,
            );
            turnTelemetryHook({
              turnNumber: turnManager.getTurnNumber(),
              actionType,
              clientPredictionMs: Math.round(clientPredictionMs * 100) / 100,
              networkRttMs: Math.round(networkRttMs * 100) / 100,
              serverTurnMs: devPerf?.serverTurnMs ?? 0,
              serverPhaseTimings: devPerf?.phaseTimingsMs ?? {},
              serverTopSystems: devPerf?.topSystems ?? [],
              enemyTurnsProcessed: devPerf?.enemyTurnsProcessed ?? 0,
              energySubTicks: devPerf?.energySubTicks ?? 0,
              reconcileMs: Math.round(reconcileMs * 100) / 100,
              syncType: serverState.type ?? (devPerf?.syncType || 'DELTA'),
              payloadBytes: devPerf?.payloadBytes ?? 0,
              deltaEntitiesAdded:
                devPerf?.entitiesAdded ?? (serverState.worldDelta?.entitiesAdded?.length ?? 0),
              deltaEntitiesRemoved:
                devPerf?.entitiesRemoved ?? (serverState.worldDelta?.entitiesRemoved?.length ?? 0),
              deltaComponentsSet:
                devPerf?.componentsSet ?? (serverState.worldDelta?.componentsSet?.length ?? 0),
              deltaComponentsRemoved:
                devPerf?.componentsRemoved ??
                (serverState.worldDelta?.componentsRemoved?.length ?? 0),
              deltaEventsCount: serverState.events?.length ?? (devPerf?.eventsEmitted ?? 0),
            });
          }
        }
      } else {
        let errorMessage = `Action failed (HTTP ${response.status})`;
        try {
          const errData = await response.json();
          if (errData?.error) {
            errorMessage = errData.error;
          }
        } catch {
          // Ignore non-JSON error body
        }
        if (response.status === 404) {
          logger.warn(`[API] Session NOT FOUND: ${activeSessionId}`, 'API');
        } else {
          logger.warn(`[API] Action rejected (${response.status}): ${errorMessage}`, 'API');
        }
        eventBus.emit('MESSAGE_EMITTED', {
          text: `[NETWORK FAULT]: ${errorMessage}`,
          type: 'error',
        });
        eventBus.flush();
      }
    } catch (error) {
      logger.error('Failed to sync with server:', 'NETWORK', error);
      eventBus.emit('MESSAGE_EMITTED', {
        text: '[NETWORK FAULT]: Failed to synchronize action with server.',
        type: 'error',
      });
      eventBus.flush();
    } finally {
      gameStore.getState().clearOptimisticUpdates();
      gameStore.getState().incrementInventoryRevision();
    }
  }

  inputManager.setActionHandler(handlePlayerInput);

  context.autoPathfinder?.setContext(context);

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
  if (context.systems) {
    for (const sys of Object.values(context.systems)) {
      sys?.dispose?.();
    }
  }

  context.autoPathfinder?.cancel();
  context.inputManager.disable();
  context.eventBus.clear();
  setActiveGameContext(null);
}
