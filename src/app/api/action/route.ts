import { NextResponse } from 'next/server';
import { ActionRequestSchema, SyncPayload } from '@shared/types';
import { sessionManager } from '@server/session/session-manager';
import { serializeWorld, serializeGrid, redactWorldForClient } from '@shared/serialization';
import { createECSWorldDelta } from '@shared/ecs-delta';
import { submitLeaderboardEntry } from '@/server/leaderboard/leaderboard-service';
import { RunMode } from '@shared/run-mode';
import { diff } from 'json-diff-ts';
import { logger } from '@engine/utils/logger';
import { GameplayEvents } from '@shared/events/types';
import { EngineInstance } from '@game/engine-factory';
import { createDefaultProfile, VaultItem, generateVaultItemId } from '@shared/profile';
import { VAULT_MAX_SLOTS } from '@shared/vault';
import { profileRepository } from '@/app/persistence/fs-profile-repository';
import economy from '@game/entities/templates/economy.json';
import { EventOriginContext } from '@engine/utils/event-context';
import {
  ExtractionIntent,
  DescentIntent,
  EquipIntent,
  UnequipIntent,
  BurnSoftwareIntent,
  Shell,
  InteractPropIntent,
  DropItemIntent,
  PickupIntent,
} from '@shared/components';
import { processAction } from '@game/pipeline/action-pipeline';
import { getRunModeConfig } from '@game/systems/run-mode-config';
import { TurnPhase } from '@engine/turn/types';
import { logTurnExecutionError } from '@/server/utils/error-logger';

export interface ServerTurnDevPerf {
  serverTurnMs: number;
  phaseTimingsMs: Record<string, number>;
  topSystems: Array<{ name: string; phase: string; durationMs: number }>;
  payloadBytes: number;
  syncType: 'FULL' | 'DELTA';
  entitiesAdded: number;
  entitiesRemoved: number;
  componentsSet: number;
  componentsRemoved: number;
  eventsEmitted: number;
}

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

    if (!sessionManager.tryAcquireSessionLock(sessionId)) {
      logger.warn(`[API] Rejecting overlapping action for busy session: ${sessionId}`, 'API');
      return NextResponse.json(
        { error: 'Session is already processing an action' },
        { status: 409 },
      );
    }

    try {
      const { world, grid, turnManager, eventBus } = session;

    // 1. Snapshot initial state
    const oldWorldState = serializeWorld(world);
    const oldGridState = serializeGrid(grid);
    const oldTurnNumber = turnManager.getTurnNumber();

    // 2. Capture all events emitted during this tick
    const capturedEvents: Array<{ type: string; payload: unknown }> = [];
    const eventCaptureHandler = (type: string, payload: unknown) => {
      capturedEvents.push({ type, payload });
    };
    eventBus.onAny(eventCaptureHandler);

    // 3. Execute turn within a transactional checkpoint (ARCH-01)
    let turnExecutionFailed = false;
    let turnErrorMessage = '';

    const isDev = process.env.NODE_ENV === 'development';
    const serverTurnT0 = isDev ? performance.now() : 0;
    const phaseTimings: Record<string, number> = {};
    const systemTimings: Array<{ name: string; phase: string; durationMs: number }> = [];

    if (isDev) {
      world.setSystemTimingHook((phase, systemName, durationMs) => {
        phaseTimings[phase] = (phaseTimings[phase] ?? 0) + durationMs;
        systemTimings.push({ name: systemName, phase, durationMs });
      });
    }

    if (process.env.NODE_ENV === 'production' && action.type === 'DEBUG_COMMAND') {
      return NextResponse.json(
        { error: 'Debug commands are disabled in production' },
        { status: 403 },
      );
    }

    try {
      const bypassInputGate = action.type === 'ABORT_RUN' || action.type === 'DEBUG_COMMAND';
      if (bypassInputGate || turnManager.canAcceptInput()) {
        const actionKey = processAction(
          world,
          grid,
          eventBus,
          session.playerId,
          action,
          { sessionId, systems: session.systems },
        );

        if (actionKey && turnManager.canAcceptInput()) {
          turnManager.submitAction(actionKey);
        }
      }

      // Always flush server events to process any immediate consequences
      eventBus.flush();
    } catch (turnError: unknown) {
      turnExecutionFailed = true;
      turnErrorMessage = turnError instanceof Error ? turnError.message : String(turnError);

      // Non-blocking background error log and file write to avoid request latency
      void logTurnExecutionError({
        sessionId,
        action,
        playerId: session.playerId,
        world,
        turnManager,
        error: turnError,
      }).catch((logErr) => {
        console.error('Failed to write error log in background:', logErr);
      });

      // 1. Roll back World to pre-turn snapshot
      world.loadSerializableState(oldWorldState);

      // 2. Roll back Grid to pre-turn snapshot
      grid.loadSerializableTiles(oldGridState.tiles);

      // 3. Roll back TurnManager state & reset phase to AWAIT_INPUT to prevent turn freezing
      turnManager.loadState(oldTurnNumber, TurnPhase.AWAIT_INPUT);
      turnManager.resetPhase(TurnPhase.AWAIT_INPUT);

      // 4. Purge transient intents attached to player during this aborted action
      world.removeComponent(session.playerId, DescentIntent);
      world.removeComponent(session.playerId, ExtractionIntent);
      world.removeComponent(session.playerId, EquipIntent);
      world.removeComponent(session.playerId, UnequipIntent);
      world.removeComponent(session.playerId, BurnSoftwareIntent);
      world.removeComponent(session.playerId, InteractPropIntent);
      world.removeComponent(session.playerId, DropItemIntent);
      world.removeComponent(session.playerId, PickupIntent);
    }

    // Stop capturing
    if (isDev) {
      world.setSystemTimingHook(null);
    }
    eventBus.offAny(eventCaptureHandler);

    if (turnExecutionFailed) {
      const rollbackPayload: SyncPayload = {
        type: 'FULL',
        world: redactWorldForClient(oldWorldState),
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

    // 4. Handle Dead-Drop Uplink & Run Persistence
    const deadDropEvents = capturedEvents.filter((e) => e.type === 'DEAD_DROP_TRANSMITTED');
    if (deadDropEvents.length > 0) {
      let profile = await profileRepository.load(sessionId);
      if (!profile) {
        profile = createDefaultProfile(sessionId);
      }

      for (const evt of deadDropEvents) {
        const ddPayload = evt.payload as GameplayEvents['DEAD_DROP_TRANSMITTED'];
        if (ddPayload.vaultItem) {
          const item = {
            ...ddPayload.vaultItem,
            vaultItemId: ddPayload.vaultItem.vaultItemId || generateVaultItemId(),
          };
          let stackedFully = false;
          if (item.itemType === 'consumable') {
            const existing = profile.vault.find(
              (v) =>
                v.itemType === 'consumable' &&
                v.templateId === item.templateId &&
                (v.quantity ?? 1) < 10,
            );
            if (existing) {
              const addAmount = item.quantity ?? 1;
              const available = 10 - (existing.quantity ?? 1);
              const actual = Math.min(addAmount, available);
              existing.quantity = (existing.quantity ?? 1) + actual;
              const remainder = addAmount - actual;
              if (remainder <= 0) {
                stackedFully = true;
              } else {
                item.quantity = remainder;
              }
            }
          }
          if (!stackedFully) {
            if (profile.vault.length < VAULT_MAX_SLOTS) {
              profile.vault.push(item);
            } else {
              profile.overflow.push(item);
            }
          }
          logger.info(
            `Dead-Drop Uplink: Transmitted item ${item.templateId} to profile vault for ${sessionId}`,
            'API',
          );
        } else if (ddPayload.blueprintId) {
          const alreadyOwned = profile.blueprintLibrary.some(
            (b) => b.blueprintId === ddPayload.blueprintId,
          );
          if (alreadyOwned) {
            const duplicateFlux = economy.conversion?.duplicateBlueprintToFlux ?? 20;
            profile.wallet.flux = Math.min(economy.caps.flux, profile.wallet.flux + duplicateFlux);
          } else {
            profile.blueprintLibrary.push({
              blueprintId: ddPayload.blueprintId,
              type: ddPayload.blueprintType ?? 'firmware',
              compiledAt: Date.now(),
            });
          }
          logger.info(
            `Dead-Drop Uplink: Transmitted blueprint ${ddPayload.blueprintId} to profile for ${sessionId}`,
            'API',
          );
        }
      }

      await profileRepository.save(profile);
    }

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
            if (!item.vaultItemId) {
              item.vaultItemId = generateVaultItemId();
            }
            if (item.itemType === 'consumable') {
              const existing = profile.vault.find(
                (v) => v.itemType === 'consumable' && v.templateId === item.templateId && (v.quantity ?? 1) < 10,
              );
              if (existing) {
                const addAmount = item.quantity ?? 1;
                const available = 10 - (existing.quantity ?? 1);
                const actual = Math.min(addAmount, available);
                existing.quantity = (existing.quantity ?? 1) + actual;
                const remainder = addAmount - actual;
                if (remainder <= 0) {
                  continue;
                }
                item.quantity = remainder;
              }
            }

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
          vaultsBreached: (payload.stats.vaultsBreached as number) || 0,
          trapsDisarmed: (payload.stats.trapsDisarmed as number) || 0,
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

    // 7. Client-facing redacted states (strip secret loot and unrevealed traps)
    const redactedNewWorld = redactWorldForClient(newWorldState);
    const redactedOldWorld = redactWorldForClient(oldWorldState);
    const clientDelta = createECSWorldDelta(redactedOldWorld, redactedNewWorld, { redactForClient: true });

    let syncPayload: SyncPayload;
    if (isMassiveChange) {
      syncPayload = {
        type: 'FULL',
        world: redactedNewWorld,
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
        worldDelta: clientDelta,
        world: redactedNewWorld,
        grid: diff(oldGridState, newGridState),
        events: syncEvents,
        turnNumber: turnManager.getTurnNumber(),
        playerId: session.playerId,
      };
    }

    let devPerf: ServerTurnDevPerf | undefined;
    if (isDev) {
      const topSystems = systemTimings
        .sort((a, b) => b.durationMs - a.durationMs)
        .slice(0, 5)
        .map((s) => ({ ...s, durationMs: Math.round(s.durationMs * 100) / 100 }));

      devPerf = {
        serverTurnMs: Math.round((performance.now() - serverTurnT0) * 100) / 100,
        phaseTimingsMs: Object.fromEntries(
          Object.entries(phaseTimings).map(([k, v]) => [k, Math.round(v * 100) / 100]),
        ),
        topSystems,
        payloadBytes: 0,
        syncType: syncPayload.type,
        entitiesAdded: syncPayload.type === 'DELTA' ? (clientDelta?.entitiesAdded?.length ?? 0) : 0,
        entitiesRemoved:
          syncPayload.type === 'DELTA' ? (clientDelta?.entitiesRemoved?.length ?? 0) : 0,
        componentsSet:
          syncPayload.type === 'DELTA' ? (clientDelta?.componentsSet?.length ?? 0) : 0,
        componentsRemoved:
          syncPayload.type === 'DELTA' ? (clientDelta?.componentsRemoved?.length ?? 0) : 0,
        eventsEmitted: capturedEvents.length,
      };
    }

    const responseBody: {
      sessionId: string;
      payload: SyncPayload;
      _devPerf?: ServerTurnDevPerf;
    } = {
      sessionId,
      payload: syncPayload,
      ...(devPerf ? { _devPerf: devPerf } : {}),
    };

    if (devPerf) {
      devPerf.payloadBytes = new TextEncoder().encode(JSON.stringify(responseBody)).length;
    }

    return NextResponse.json(responseBody);
    } finally {
      sessionManager.releaseSessionLock(sessionId);
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('API Error:', 'API', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: errorMessage },
      { status: 500 },
    );
  }
}
