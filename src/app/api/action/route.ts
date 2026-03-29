import { NextResponse } from 'next/server';
import { ActionRequestSchema } from '@shared/types';
import { sessionManager } from '@engine/session/SessionManager';
import { serializeWorld, serializeGrid } from '@shared/serialization';
import { diff } from 'json-diff-ts';
import { DIRECTIONS, GameAction } from '@game/input/actions';
import { logger } from '@shared/utils/logger';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const result = ActionRequestSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: 'Invalid request', details: result.error }, { status: 400 });
    }

    const { sessionId, action } = result.data;
    const session = sessionManager.getSession(sessionId);
    if (!session) {
      logger.warn(`[API] Session NOT FOUND: ${sessionId}`);
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const { world, grid, turnManager } = session;

    // 1. Snapshot initial state
    const oldWorldState = serializeWorld(world);
    const oldGridState = serializeGrid(grid);

    // 2. Process Action
    // Map ActionIntent to GameAction string for TurnManager
    let actionKey: string | null = null;

    if (action.type === 'MOVE') {
      for (const [key, dir] of Object.entries(DIRECTIONS)) {
        if (dir.dx === action.dx && dir.dy === action.dy) {
          actionKey = key;
          break;
        }
      }
    } else if (action.type === 'WAIT') {
      actionKey = GameAction.WAIT;
    }

    if (actionKey && turnManager.canAcceptInput()) {
      turnManager.submitAction(actionKey);
    } else {
      // If we can't map it or input is not accepted, we still return the current state/empty delta
      // or we could return an error. For now, just process if valid.
    }

    // 3. Snapshot final state
    const newWorldState = serializeWorld(world);
    const newGridState = serializeGrid(grid);

    // 4. Calculate Delta
    const delta = {
      world: diff(oldWorldState, newWorldState),
      grid: diff(oldGridState, newGridState),
    };

    return NextResponse.json({
      sessionId,
      delta,
      turnNumber: turnManager.getTurnNumber()
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    logger.error('API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error', message: error.message }, { status: 500 });
  }
}
