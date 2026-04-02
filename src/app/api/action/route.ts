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

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const result = ActionRequestSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: 'Invalid request', details: result.error }, { status: 400 });
    }

    const { sessionId, action } = result.data;
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
          if (dir.dx === action.dx && dir.dy === action.dy) {
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

      case 'STAIRCASE_DESCEND':
        eventBus.emit('STAIRCASE_INTERACTION', {
          entityId: session.playerId,
          staircaseId: action.staircaseId,
          targetFloor: action.targetFloor,
        });
        break;

      case 'ANCHOR_DESCEND': {
        eventBus.emit('ANCHOR_DESCEND', {
          anchorId: action.anchorId,
          cost: action.cost,
        });
        // Anchors also trigger the staircase interaction logic for actual descent
        const currentFloor = world.getComponent(session.playerId, FloorState)?.currentFloor ?? 1;
        eventBus.emit('STAIRCASE_INTERACTION', {
          entityId: session.playerId,
          staircaseId: action.anchorId,
          targetFloor: currentFloor + 1,
        });
        break;
      }

      case 'ANCHOR_EXTRACT':
        eventBus.emit('ANCHOR_EXTRACT', {});
        break;
    }

    if (actionKey && turnManager.canAcceptInput()) {
      turnManager.submitAction(actionKey);
      // Synchronously flush server events if they aren't auto-flushed by systems
      eventBus.flush();
    } else {
      // If we can't map it or input is not accepted, we still return the current state/empty delta
      // or we could return an error. For now, just process if valid.
    }

    // Stop capturing
    eventBus.offAny(eventCaptureHandler);

    // 3. Snapshot final state
    const newWorldState = serializeWorld(world);
    const newGridState = serializeGrid(grid);

    // 4. Determine Sync Strategy
    const isMassiveChange = capturedEvents.some(e => 
      e.type === 'FLOOR_TRANSITION' || e.type === 'DUNGEON_GENERATED'
    );

    let payload: SyncPayload;
    if (isMassiveChange) {
      logger.info(`[API] Massive change detected, sending FULL state sync.`);
      payload = {
        type: 'FULL',
        world: newWorldState,
        grid: newGridState,
        events: capturedEvents,
        turnNumber: turnManager.getTurnNumber(),
        phase: turnManager.getPhase(),
      };
    } else {
      payload = {
        type: 'DELTA',
        world: newWorldState,
        grid: diff(oldGridState, newGridState),
        events: capturedEvents,
        turnNumber: turnManager.getTurnNumber(),
      };
    }
 
    return NextResponse.json({
      sessionId,
      payload,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    logger.error('API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error', message: error.message }, { status: 500 });
  }
}
