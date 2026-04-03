import { NextResponse } from 'next/server';
import { createEngineInstance } from '@game/engine-factory';
import { sessionManager } from '@engine/session/SessionManager';
import { createDefaultProfile } from '@shared/profile';
import { profileRepository } from '@/app/persistence/fs-profile-repository';
import { runInventoryRegistry } from '@game/systems/run-inventory';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { seed, width, height, sessionId: providedSessionId } = body;

    if (!seed || !width || !height) {
      return NextResponse.json({ error: 'Missing required parameters: seed, width, height' }, { status: 400 });
    }

    const sessionId = providedSessionId || 'default-player-session';

    // Ensure authoritative registry is clean for new run (D-05/D-06)
    console.log(`[API] Clearing run inventory registry for session: ${sessionId}`);
    runInventoryRegistry.clear(sessionId);

    // Load or create profile
    let profile = await profileRepository.load(sessionId);
    if (!profile) {
      profile = createDefaultProfile(sessionId);
    }

    const instance = createEngineInstance({ seed, width, height, profile, sessionId });

    instance.turnManager.start();

    sessionManager.createSession(sessionId, {
      world: instance.world,
      grid: instance.grid,
      playerId: instance.playerId,
      turnManager: instance.turnManager,
      eventBus: instance.eventBus,
      //@ts-expect-error - EngineInstance.systems matches WorldState.systems expectation
      systems: instance.systems,
    });

    console.log(`[API] Session created: ${sessionId} (seed: ${seed})`);

    return NextResponse.json({ sessionId });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error('API Error (session creation):', error);
    return NextResponse.json({ error: 'Internal Server Error', message: error.message }, { status: 500 });
  }
}
