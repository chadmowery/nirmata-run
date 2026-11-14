import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createEngineInstance } from '@game/engine-factory';
import { sessionManager } from '@server/session/session-manager';
import { createDefaultProfile } from '@shared/profile';
import { profileRepository } from '@/app/persistence/fs-profile-repository';
import { DEFAULT_GRID_WIDTH, DEFAULT_GRID_HEIGHT, DEFAULT_SHELL_ID } from '@/shared/constants';
import { RunMode } from '@shared/run-mode';
import { logger } from '@engine/utils/logger';
import { globalShellRegistry, applyShellUpgradesToRecord } from '@/game/shells/server';
import { serializeWorld, serializeGrid } from '@shared/serialization';
import { FullSyncPayload } from '@shared/types';
import { TurnPhase } from '@engine/turn/types';
import { truncateSessionId } from '@shared/reports/sanitize';

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
    const requestedShellId = parsed.data.shellId || DEFAULT_SHELL_ID;
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

    logger.info(`Session created: ${truncateSessionId(sessionId)} (seed: ${seed})`, 'API');

    let initialState: FullSyncPayload | undefined;
    if (
      typeof instance.world?.getSerializableState === 'function' &&
      typeof instance.grid?.getSerializableTiles === 'function'
    ) {
      initialState = {
        type: 'FULL',
        world: serializeWorld(instance.world, { redactForClient: true }),
        grid: serializeGrid(instance.grid),
        playerId: instance.playerId,
        turnNumber: instance.turnManager?.getTurnNumber?.() ?? 0,
        phase: instance.turnManager?.getPhase?.() ?? TurnPhase.AWAIT_INPUT,
        events: [],
      };
    }

    return NextResponse.json({
      sessionId,
      ...(initialState ? { initialState } : {}),
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    logger.error('API Error (session creation)', 'API', { error });
    return NextResponse.json(
      { error: 'Internal Server Error', message: error.message },
      { status: 500 },
    );
  }
}
