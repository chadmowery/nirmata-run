import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createEngineInstance } from '@game/engine-factory';
import { sessionManager, type WorldState } from '@server/session/session-manager';
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
import { FloorState, Health, Shell } from '@shared/components';
import type { EntityRegistry } from '@engine/entity/registry';
import type { EngineEvents } from '@engine/events/types';

const CreateSessionRequestSchema = z.object({
  seed: z.string().min(1),
  sessionId: z.string().optional(),
  mode: z.string().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  shellId: z.string().optional(),
});

function isResumableSimulationSession(state: WorldState<EngineEvents, unknown>): boolean {
  if (state.runMode && state.runMode !== RunMode.SIMULATION) {
    return false;
  }
  if (!state.world?.entityExists?.(state.playerId)) {
    return false;
  }
  const health = state.world.getComponent(state.playerId, Health);
  if (health && health.isAlive === false) {
    return false;
  }
  return true;
}

function buildFullSyncPayload(state: WorldState<EngineEvents, unknown>): FullSyncPayload | undefined {
  if (
    typeof state.world?.getSerializableState !== 'function' ||
    typeof state.grid?.getSerializableTiles !== 'function'
  ) {
    return undefined;
  }
  return {
    type: 'FULL',
    world: serializeWorld(state.world, { redactForClient: true }),
    grid: serializeGrid(state.grid),
    playerId: state.playerId,
    turnNumber: state.turnManager?.getTurnNumber?.() ?? 0,
    phase: state.turnManager?.getPhase?.() ?? TurnPhase.AWAIT_INPUT,
    events: [],
  };
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const requestedSessionId = url.searchParams.get('sessionId') || undefined;

    let resolvedSessionId: string | undefined;
    let resolvedState: WorldState<EngineEvents, unknown> | undefined;

    if (requestedSessionId) {
      const candidate = sessionManager.getSession(requestedSessionId);
      if (candidate && isResumableSimulationSession(candidate)) {
        resolvedSessionId = requestedSessionId;
        resolvedState = candidate;
      }
    }

    if (!resolvedState && process.env.NODE_ENV !== 'production') {
      const latest = sessionManager.getLatestSession((_id, state) =>
        isResumableSimulationSession(state),
      );
      if (latest) {
        resolvedSessionId = latest.sessionId;
        resolvedState = latest.state;
      }
    }

    if (!resolvedState || !resolvedSessionId) {
      return NextResponse.json({ active: false });
    }

    const initialState = buildFullSyncPayload(resolvedState);
    let floorNumber = 1;
    const floorEntities = resolvedState.world.query(FloorState);
    if (floorEntities.length > 0) {
      const fs = resolvedState.world.getComponent(floorEntities[0], FloorState);
      if (fs && typeof fs.currentFloor === 'number') {
        floorNumber = fs.currentFloor;
      }
    }
    const playerShell = resolvedState.world.getComponent(resolvedState.playerId, Shell);
    const shellId = playerShell?.archetypeId ?? resolvedState.shellId ?? DEFAULT_SHELL_ID;

    return NextResponse.json({
      active: true,
      sessionId: resolvedSessionId,
      shellId,
      floorNumber,
      runMode: resolvedState.runMode ?? RunMode.SIMULATION,
      seed: resolvedState.seed ?? `resumed-${resolvedSessionId}`,
      ...(initialState ? { initialState } : {}),
    });
  } catch (error) {
    logger.error('API Error (session lookup)', 'API', { error });
    return NextResponse.json({ active: false }, { status: 500 });
  }
}

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
      seed,
      entityRegistry: (instance as { entityRegistry?: EntityRegistry }).entityRegistry,
      entityFactory: instance.entityFactory,
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
