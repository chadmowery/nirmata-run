import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createEngineInstance } from '@game/engine-factory';
import { sessionManager } from '@server/session/session-manager';
import { createDefaultProfile } from '@shared/profile';
import { profileRepository } from '@/app/persistence/fs-profile-repository';
import { DEFAULT_GRID_WIDTH, DEFAULT_GRID_HEIGHT } from '@/shared/constants';
import { RunMode } from '@shared/run-mode';
import { logger } from '@engine/utils/logger';
import { globalShellRegistry, applyShellUpgradesToRecord } from '@/game/shells/server';

const CreateSessionRequestSchema = z.object({
  seed: z.string().min(1),
  sessionId: z.string().optional(),
  mode: z.string().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  shellId: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const rawBody = await req.json();
    const parsed = CreateSessionRequestSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parsed.error },
        { status: 400 },
      );
    }

    const { seed, sessionId: providedSessionId, mode } = parsed.data;
    const width = parsed.data.width || DEFAULT_GRID_WIDTH;
    const height = parsed.data.height || DEFAULT_GRID_HEIGHT;

    if (mode === RunMode.WEEKLY || mode === RunMode.DAILY) {
      return NextResponse.json(
        { error: 'Competitive modes (weekly/daily) must be launched via /api/run-mode/launch' },
        { status: 403 },
      );
    }

    const sessionId = providedSessionId || 'default-player-session';

    // Load or create profile
    let profile = await profileRepository.load(sessionId);
    if (!profile) {
      profile = createDefaultProfile(sessionId);
    }

    // Shell resolution
    let shellRecord = null;
    const requestedShellId = parsed.data.shellId;
    if (requestedShellId) {
      shellRecord = globalShellRegistry.get(requestedShellId);
      if (!shellRecord) {
        shellRecord = globalShellRegistry.createRecord(requestedShellId, requestedShellId);
      }
      if (profile.shellUpgrades?.[requestedShellId]) {
        shellRecord = applyShellUpgradesToRecord(shellRecord, profile.shellUpgrades[requestedShellId]);
      }
    }

    const instance = createEngineInstance({
      seed,
      width,
      height,
      profile,
      sessionId,
      runMode: RunMode.SIMULATION,
      shellRecord: shellRecord || undefined,
    });

    instance.turnManager.start();

    sessionManager.createSession(sessionId, {
      world: instance.world,
      grid: instance.grid,
      playerId: instance.playerId,
      turnManager: instance.turnManager,
      eventBus: instance.eventBus,
      systems: instance.systems,
      runMode: RunMode.SIMULATION,
      shellId: requestedShellId || undefined,
    });

    logger.info(`Session created: ${sessionId} (seed: ${seed})`, 'API');

    return NextResponse.json({ sessionId });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    logger.error('API Error (session creation)', 'API', { error });
    return NextResponse.json(
      { error: 'Internal Server Error', message: error.message },
      { status: 500 },
    );
  }
}
