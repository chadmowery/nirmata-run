import { NextResponse } from 'next/server';
import { z } from 'zod';
import { checkNonProductionOnly } from '@/server/security/env-gate';
import { createEngineInstance } from '@game/engine-factory';
import { sessionManager } from '@server/session/session-manager';
import { createDefaultProfile } from '@shared/profile';
import { profileRepository } from '@/app/persistence/fs-profile-repository';
import { DEFAULT_GRID_HEIGHT, DEFAULT_GRID_WIDTH, DEFAULT_SHELL_ID } from '@/shared/constants';
import { RunMode } from '@shared/run-mode';
import { globalShellRegistry, applyShellUpgradesToRecord } from '@/game/shells/server';
import { TurnPhase } from '@engine/turn/types';
import { serializeGrid, serializeWorld } from '@shared/serialization';
import type { EntityRegistry } from '@engine/entity/registry';

const QuickLaunchSchema = z.object({
  shellId: z.string().optional(),
  seed: z.string().optional(),
  sessionId: z.string().optional(),
});

export async function POST(req: Request) {
  const gate = checkNonProductionOnly();
  if (gate) return gate;

  try {
    const rawBody = await req.json().catch(() => ({}));
    const parsed = QuickLaunchSchema.safeParse(rawBody);
    const shellId = parsed.success && parsed.data.shellId ? parsed.data.shellId : DEFAULT_SHELL_ID;
    const seed =
      parsed.success && parsed.data.seed ? parsed.data.seed : `dev-${Date.now().toString(36)}`;
    const sessionId =
      parsed.success && parsed.data.sessionId
        ? parsed.data.sessionId
        : `dev-run-${Date.now().toString(36)}`;

    let profile = await profileRepository.load(sessionId);
    if (!profile) {
      profile = createDefaultProfile(sessionId);
    }

    let shellRecord = globalShellRegistry.get(shellId);
    if (!shellRecord) {
      const hasTpl = globalShellRegistry.getTemplates().some((t) => t.id === shellId);
      const archetypeId = hasTpl ? shellId : DEFAULT_SHELL_ID;
      shellRecord = globalShellRegistry.createRecord(`${sessionId}-${archetypeId}`, archetypeId);
    }
    if (profile.shellUpgrades?.[shellId]) {
      shellRecord = applyShellUpgradesToRecord(shellRecord, profile.shellUpgrades[shellId]);
    }

    const instance = createEngineInstance({
      seed,
      width: DEFAULT_GRID_WIDTH,
      height: DEFAULT_GRID_HEIGHT,
      profile,
      sessionId,
      runMode: RunMode.SIMULATION,
      shellRecord,
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
      shellId,
      shellUpgrades: profile.shellUpgrades,
      seed,
      entityRegistry: (instance as { entityRegistry?: EntityRegistry }).entityRegistry,
      entityFactory: instance.entityFactory,
    });

    const initialState = {
      type: 'FULL' as const,
      world: serializeWorld(instance.world, { redactForClient: true }),
      grid: serializeGrid(instance.grid),
      playerId: instance.playerId,
      turnNumber: instance.turnManager?.getTurnNumber?.() ?? 0,
      phase: instance.turnManager?.getPhase?.() ?? TurnPhase.AWAIT_INPUT,
      events: [],
    };

    return NextResponse.json({
      success: true,
      sessionId,
      shellId,
      seed,
      initialState,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Quick launch failed' },
      { status: 500 },
    );
  }
}
