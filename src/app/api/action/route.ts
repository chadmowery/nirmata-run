import { NextResponse } from 'next/server';
import { ActionRequestSchema, SyncPayload } from '@shared/types';
import { sessionManager } from '@engine/session/SessionManager';
import { serializeWorld, serializeGrid } from '@shared/serialization';
import { diff } from 'json-diff-ts';
import { DIRECTIONS, GameAction } from '@game/input/actions';
import { logger } from '@shared/utils/logger';
import { GameplayEvents } from '@shared/events/types';
import { EngineInstance } from '@game/engine-factory';
import { FloorState } from '@shared/components/floor-state';
import { createDefaultProfile, VaultItem } from '@shared/profile';
import { profileRepository } from '@/app/persistence/fs-profile-repository';
import { runInventoryRegistry } from '@game/systems/run-inventory';
import economy from '@game/entities/templates/economy.json';

export async function POST(req: Request) {

  try {
    const body = await req.json();
    const result = ActionRequestSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: 'Invalid request', details: result.error }, { status: 400 });
    }

    const { sessionId, action } = result.data;
    logger.info(`[API] Processing action: ${action.type} for session: ${sessionId}`);
    const session = sessionManager.getSession<GameplayEvents, EngineInstance['systems']>(sessionId);
    if (!session) {
      logger.warn(`[API] Session NOT FOUND: ${sessionId}`);
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const { world, grid, turnManager, eventBus } = session;

    // 1. Snapshot initial state
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
          session.systems.firmware.activateAbility(session.playerId, action.slotIndex, action.targetX, action.targetY);
          actionKey = `USE_FIRMWARE_${action.slotIndex}`;
        }
        break;

      case 'VENT':
        if (session.systems?.heat) {
          session.systems.heat.vent(session.playerId);
          actionKey = GameAction.VENT;
        }
        break;

      case 'STAIRCASE_DESCEND': {
        const floorState = world.getComponent(session.playerId, FloorState);
        eventBus.emit('STAIRCASE_DESCEND_TRIGGERED', {
          entityId: session.playerId,
          targetFloor: action.targetFloor,
          runSeed: floorState?.runSeed ?? 'default',
        });
        break;
      }

      case 'ANCHOR_DESCEND': {
        eventBus.emit('ANCHOR_DESCEND', {
          anchorId: action.anchorId,
          cost: action.cost,
        });

        // Use new descent trigger event
        const floorState = world.getComponent(session.playerId, FloorState);
        eventBus.emit('STAIRCASE_DESCEND_TRIGGERED', {
          entityId: session.playerId,
          targetFloor: (floorState?.currentFloor ?? 1) + 1,
          runSeed: floorState?.runSeed ?? 'default',
        });
        break;
      }

      case 'ANCHOR_EXTRACT':
        eventBus.emit('ANCHOR_EXTRACT', {});
        break;
    }

    if (actionKey && turnManager.canAcceptInput()) {
      turnManager.submitAction(actionKey);
    } 
    
    // Always flush server events to process any immediate consequences
    eventBus.flush();


    // Stop capturing
    eventBus.offAny(eventCaptureHandler);
    
    // 4. Handle Run Persistence


    const runEndedEvent = capturedEvents.find(e => e.type === 'RUN_ENDED');
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
        if (payload.stats.itemsExtracted && (payload.stats.itemsExtracted as VaultItem[]).length > 0) {
          console.log(`[API] Processing extraction for ${sessionId}: ${(payload.stats.itemsExtracted as VaultItem[]).length} items.`);
          
          const VAULT_CAPACITY = 20;
          const items = payload.stats.itemsExtracted as VaultItem[];
          
          for (const item of items) {
            if (profile.vault.length < VAULT_CAPACITY) {
              profile.vault.push(item);
            } else {
              profile.overflow.push(item);
            }
          }
        }
      }

      await profileRepository.save(profile);
    }

    // 5. Snapshot final state
    const newWorldState = serializeWorld(world);
    const newGridState = serializeGrid(grid);

    // 6. Determine Sync Strategy
    const isMassiveChange = capturedEvents.some(e => 
      e.type === 'FLOOR_TRANSITION' || e.type === 'DUNGEON_GENERATED'
    ) || turnManager.getTurnNumber() <= 1;

    let syncPayload: SyncPayload;
    if (isMassiveChange) {
      syncPayload = {
        type: 'FULL',
        world: newWorldState,
        grid: newGridState,
        events: capturedEvents,
        turnNumber: turnManager.getTurnNumber(),
        playerId: session.playerId,
        phase: turnManager.getPhase(),
        runInventory: runInventoryRegistry.getOrCreate(sessionId),
      };
      logger.info(`[API] Sending FULL state sync (Massive Change: ${isMassiveChange}).`);
    } else {
      logger.info(`[API] Sending DELTA state sync.`);
      syncPayload = {
        type: 'DELTA',
        world: newWorldState,
        grid: diff(oldGridState, newGridState),
        events: capturedEvents,
        turnNumber: turnManager.getTurnNumber(),
        playerId: session.playerId,
        runInventory: runInventoryRegistry.getOrCreate(sessionId),
      };
    }
 
    return NextResponse.json({
      sessionId,
      payload: syncPayload,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error', message: errorMessage }, { status: 500 });
  }
}
