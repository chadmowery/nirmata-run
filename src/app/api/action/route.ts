import { NextResponse } from 'next/server';
import { ActionRequestSchema, SyncPayload } from '@shared/types';
import { sessionManager } from '@server/session/session-manager';
import { serializeWorld, serializeGrid } from '@shared/serialization';
import { createECSWorldDelta } from '@shared/ecs-delta';
import { submitLeaderboardEntry } from '@/server/leaderboard/leaderboard-service';
import { RunMode } from '@shared/run-mode';
import { diff } from 'json-diff-ts';
import { DIRECTIONS, GameAction } from '@game/input/actions';
import { logger } from '@engine/utils/logger';
import { GameplayEvents } from '@shared/events/types';
import { EngineInstance } from '@game/engine-factory';
import { FloorState } from '@shared/components/floor-state';
import { createDefaultProfile, VaultItem } from '@shared/profile';
import { VAULT_MAX_SLOTS } from '@shared/vault';
import { profileRepository } from '@/app/persistence/fs-profile-repository';
import economy from '@game/entities/templates/economy.json';
import { handleServerDebugCommand } from '@game/debug/server-debug-handler';
import { EventOriginContext } from '@engine/utils/event-context';
import {
  ExtractionIntent,
  DescentIntent,
  EquipIntent,
  UnequipIntent,
  BurnSoftwareIntent,
  RunInventory,
  Shell,
} from '@shared/components';
import { getRunModeConfig } from '@game/systems/run-mode-config';
import { handleInventorySwap } from '@game/intent/inventory-intent';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const result = ActionRequestSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: result.error },
        { status: 400 },
      );
    }

    const { sessionId, action } = result.data;
    EventOriginContext.current = 'server';
    logger.info(`[API] Processing action: ${action.type} for session: ${sessionId}`, 'API');
    const session = sessionManager.getSession<GameplayEvents, EngineInstance['systems']>(sessionId);
    if (!session) {
      logger.warn(`[API] Session NOT FOUND: ${sessionId}`, 'API');
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    logger.info(`Session Found for ${sessionId}. PlayerId: ${session.playerId}`, 'API');

    const { world, grid, turnManager, eventBus } = session;

    // 1. Snapshot initial state
    const oldWorldState = serializeWorld(world);
    const oldGridState = serializeGrid(grid);

    // 2. Capture all events emitted during this tick
    const capturedEvents: Array<{ type: string; payload: unknown }> = [];
    const eventCaptureHandler = (type: string, payload: unknown) => {
      capturedEvents.push({ type, payload });
    };
    eventBus.onAny(eventCaptureHandler);

    // 3. Process Action Intent
    let actionKey: string | null = null;

    switch (action.type) {
      case 'MOVE':
        for (const [key, dir] of Object.entries(DIRECTIONS)) {
          const d = dir as { dx: number; dy: number };
          if (d.dx === action.dx && d.dy === action.dy) {
            actionKey = key;
            break;
          }
        }
        break;

      case 'WAIT':
        actionKey = GameAction.WAIT;
        break;

      case 'USE_FIRMWARE':
        if (session.systems?.firmware) {
          // Encode coordinates into actionKey so the TurnManager handler can use them
          actionKey = `USE_FIRMWARE_${action.slotIndex}:${action.targetX}:${action.targetY}`;
        }
        break;

      case 'VENT':
        actionKey = GameAction.VENT;
        break;

      case 'STAIRCASE_DESCEND': {
        world.addComponent(session.playerId, DescentIntent, {
          targetFloor: action.targetFloor,
          cost: 0,
        });
        actionKey = 'STAIRCASE_DESCEND';
        break;
      }

      case 'ANCHOR_DESCEND': {
        const floorState = world.getComponent(session.playerId, FloorState);
        world.addComponent(session.playerId, DescentIntent, {
          targetFloor: (floorState?.currentFloor ?? 1) + 1,
          cost: action.cost,
        });
        actionKey = 'ANCHOR_DESCEND';
        break;
      }

      case 'ANCHOR_EXTRACT':
        world.addComponent(session.playerId, ExtractionIntent, { reason: 'manual' });
        actionKey = 'ANCHOR_EXTRACT';
        break;

      case 'INVENTORY_SWAP': {
        handleInventorySwap(world, session.playerId, action.sourceIndex, action.destinationIndex);
        actionKey = 'INVENTORY_SWAP';
        break;
      }

      case 'EQUIP': {
        world.addComponent(session.playerId, EquipIntent, {
          slotType: action.slotType,
          itemEntityId: action.itemEntityId,
        });
        actionKey = 'EQUIP';
        break;
      }

      case 'UNEQUIP': {
        world.addComponent(session.playerId, UnequipIntent, {
          slotType: action.slotType,
          slotIndex: action.slotIndex,
        });
        actionKey = 'UNEQUIP';
        break;
      }

      case 'BURN_SOFTWARE': {
        const inventory = world.getComponent(session.playerId, RunInventory);
        const swItem = inventory?.software[action.runInventoryIndex];
        if (swItem) {
          world.addComponent(session.playerId, BurnSoftwareIntent, {
            actorId: session.playerId,
            softwareEntityId: swItem.entityId,
            targetSlot: action.targetSlot,
            inventoryIndex: action.runInventoryIndex,
          });
        }
        actionKey = 'BURN_SOFTWARE';
        break;
      }

      case 'DEBUG_COMMAND':
        handleServerDebugCommand(
          world,
          eventBus,
          session.playerId,
          sessionId,
          action.command,
          action.args,
          session.systems,
        );
        break;
    }

    // Execute turn within a transactional checkpoint (ARCH-01)
    let turnExecutionFailed = false;
    let turnErrorMessage = '';

    try {
      if (actionKey && turnManager.canAcceptInput()) {
        turnManager.submitAction(actionKey);
      }

      // Always flush server events to process any immediate consequences
      eventBus.flush();
    } catch (turnError: unknown) {
      turnExecutionFailed = true;
      turnErrorMessage = turnError instanceof Error ? turnError.message : String(turnError);
      logger.error(
        `[API] Exception during turn execution for session ${sessionId}. Restoring pre-turn checkpoint.`,
        'API',
        turnError,
      );

      // 1. Roll back World to pre-turn snapshot
      world.loadSerializableState(oldWorldState);

      // 2. Roll back Grid to pre-turn snapshot
      grid.loadSerializableTiles(oldGridState.tiles);

      // 3. Purge transient intents attached to player during this aborted action
      world.removeComponent(session.playerId, DescentIntent);
      world.removeComponent(session.playerId, ExtractionIntent);
      world.removeComponent(session.playerId, EquipIntent);
      world.removeComponent(session.playerId, UnequipIntent);
      world.removeComponent(session.playerId, BurnSoftwareIntent);
    }

    // Stop capturing
    eventBus.offAny(eventCaptureHandler);

    if (turnExecutionFailed) {
      const rollbackPayload: SyncPayload = {
        type: 'FULL',
        world: oldWorldState,
        grid: oldGridState,
        events: [
          {
            type: 'MESSAGE_EMITTED',
            payload: {
              text: `FAULT ISOLATED: Action aborted (${turnErrorMessage}). Game state rolled back safely.`,
              type: 'error',
            },
          },
        ],
        turnNumber: turnManager.getTurnNumber(),
        playerId: session.playerId,
        phase: turnManager.getPhase(),
      };

      return NextResponse.json({
        sessionId,
        payload: rollbackPayload,
        warning: `Turn execution rolled back due to error: ${turnErrorMessage}`,
      });
    }

    // 4. Handle Run Persistence
    const runEndedEvent = capturedEvents.find((e) => e.type === 'RUN_ENDED');
    if (runEndedEvent) {
      const payload = runEndedEvent.payload as GameplayEvents['RUN_ENDED'];

      let profile = await profileRepository.load(sessionId);
      if (!profile) {
        profile = createDefaultProfile(sessionId);
      }

      const finalScrap = (payload.stats.scrapExtracted as number) || 0;
      const finalFlux = (payload.stats.fluxExtracted as number) || 0;

      profile.wallet.scrap = Math.min(economy.caps.scrap, profile.wallet.scrap + finalScrap);
      profile.wallet.flux = Math.min(economy.caps.flux, profile.wallet.flux + finalFlux);

      if (payload.reason === 'extraction') {
        // Extraction SUCCESS (D-09/D-13)
        // Prioritize adding extracted items to the vault, then overflow
        const items = (payload.stats.itemsExtracted as VaultItem[]) || [];
        if (items.length > 0) {
          logger.info(`Processing extraction for ${sessionId}: ${items.length} items.`, 'API');

          for (const item of items) {
            if (profile.vault.length < VAULT_MAX_SLOTS) {
              profile.vault.push(item);
            } else {
              profile.overflow.push(item);
            }
          }
        }

        // Blueprints extraction (BUG-06)
        const blueprints = payload.stats.blueprintsExtracted || [];
        for (const bp of blueprints) {
          const alreadyOwned = profile.blueprintLibrary.some(
            (b) => b.blueprintId === bp.blueprintId,
          );
          if (alreadyOwned) {
            const duplicateFlux = economy.conversion?.duplicateBlueprintToFlux ?? 20;
            profile.wallet.flux = Math.min(economy.caps.flux, profile.wallet.flux + duplicateFlux);
            logger.info(
              `Duplicate blueprint ${bp.blueprintId} converted to ${duplicateFlux} Flux for ${sessionId}`,
              'API',
            );
          } else {
            profile.blueprintLibrary.push({
              blueprintId: bp.blueprintId,
              type: bp.type,
              compiledAt: Date.now(),
            });
            logger.info(
              `New blueprint ${bp.blueprintId} (${bp.type}) added to library for ${sessionId}`,
              'API',
            );
          }
        }
      } else {
        // Run FAILED / DEATH PENALTY (BUG-05)
        const effectiveMode = session.runMode || payload.stats.runMode || RunMode.SIMULATION;
        const modeConfig = await getRunModeConfig(effectiveMode);
        const playerShell = world.getComponent(session.playerId, Shell);
        const activeShellId = session.shellId || playerShell?.archetypeId;

        if (modeConfig.deathPenalty.loseInstalledItems) {
          if (activeShellId) {
            profile.installedItems = profile.installedItems.filter(
              (item) => item.shellId !== activeShellId,
            );
            logger.info(
              `Death Penalty: Cleared installed items for shell ${activeShellId} on session ${sessionId}`,
              'API',
            );
          } else {
            profile.installedItems = [];
            logger.info(
              `Death Penalty: Cleared all installed items on session ${sessionId}`,
              'API',
            );
          }
        }

        if (modeConfig.deathPenalty.resetShellUpgrades) {
          profile.shellUpgrades = {};
          logger.info(`Death Penalty: Reset shell upgrades on session ${sessionId}`, 'API');
        }
      }

      await profileRepository.save(profile);

      // Automatic Server-Side Leaderboard Submission (Phase 4)
      if (session.runMode && session.runMode !== RunMode.SIMULATION) {
        await submitLeaderboardEntry(sessionId, session.runMode, {
          floorNumber: payload.floorNumber,
          scrapExtracted: finalScrap,
          softwareExtracted: (payload.stats.softwareExtracted as number) || 0,
          fluxExtracted: finalFlux,
        });
      }
    }

    // 5. Snapshot final state
    const newWorldState = serializeWorld(world);
    const newGridState = serializeGrid(grid);

    // 6. Determine Sync Strategy
    const isMassiveChange =
      capturedEvents.some((e) => e.type === 'FLOOR_TRANSITION' || e.type === 'DUNGEON_GENERATED') ||
      turnManager.getTurnNumber() <= 1;

    // Filter out internal request events that should not be replayed on the client
    const EXCLUDED_SYNC_EVENTS = new Set([
      'PLAYER_ACTION',
      'GAME_PAUSE_REQUESTED',
      'GAME_RESUME_REQUESTED',
    ]);
    const syncEvents = capturedEvents.filter((e) => !EXCLUDED_SYNC_EVENTS.has(e.type));

    let syncPayload: SyncPayload;
    if (isMassiveChange) {
      syncPayload = {
        type: 'FULL',
        world: newWorldState,
        grid: newGridState,
        events: syncEvents,
        turnNumber: turnManager.getTurnNumber(),
        playerId: session.playerId,
        phase: turnManager.getPhase(),
      };
      logger.info(`[API] Sending FULL state sync (Massive Change: ${isMassiveChange}).`, 'API');
    } else {
      logger.info(`[API] Sending DELTA state sync.`, 'API');
      syncPayload = {
        type: 'DELTA',
        worldDelta: createECSWorldDelta(oldWorldState, newWorldState),
        world: newWorldState,
        grid: diff(oldGridState, newGridState),
        events: syncEvents,
        turnNumber: turnManager.getTurnNumber(),
        playerId: session.playerId,
      };
    }

    return NextResponse.json({
      sessionId,
      payload: syncPayload,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('API Error:', 'API', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: errorMessage },
      { status: 500 },
    );
  }
}
