import { NextResponse } from 'next/server';
import { createEngineInstance } from '@game/engine-factory';
import { sessionManager } from '@engine/session/SessionManager';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { seed, width, height } = body;

    if (!seed || !width || !height) {
      return NextResponse.json({ error: 'Missing required parameters: seed, width, height' }, { status: 400 });
    }

    const sessionId = crypto.randomUUID();
    const instance = createEngineInstance({ seed, width, height });

    instance.turnManager.start();

    sessionManager.createSession(sessionId, {
      world: instance.world,
      grid: instance.grid,
      playerId: instance.playerId,
      turnManager: instance.turnManager,
      eventBus: instance.eventBus,
    });

    console.log(`[API] Session created: ${sessionId} (seed: ${seed})`);

    return NextResponse.json({ sessionId });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error('API Error (session creation):', error);
    return NextResponse.json({ error: 'Internal Server Error', message: error.message }, { status: 500 });
  }
}
