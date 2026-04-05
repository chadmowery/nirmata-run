import { NextRequest, NextResponse } from 'next/server';
import { profileRepository } from '@/app/persistence/fs-profile-repository';
import { RunMode, getRunModeConfig } from '@/game/systems/run-mode-config';
import { sessionManager } from '@/engine/session/SessionManager';
import { createEngineInstance } from '@/game/engine-factory';

/**
 * POST /api/run-mode/launch
 * Launches a new run in the specified mode.
 */
export async function POST(req: NextRequest) {
  try {
    const { sessionId, mode } = await req.json();

    if (!sessionId || !mode) {
      return NextResponse.json({ error: 'Missing sessionId or mode' }, { status: 400 });
    }

    const profile = await profileRepository.load(sessionId);
    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // 1. Check Overflow (D-07)
    if (profile.overflow.length > 0) {
      return NextResponse.json({ error: 'Vault overflow must be cleared before starting a new run' }, { status: 403 });
    }

    // 2. Load Config
    const config = await getRunModeConfig(mode as RunMode);
    const now = new Date();
    const currentDay = Math.floor(now.getTime() / (24 * 60 * 60 * 1000));
    const currentWeek = Math.floor(now.getTime() / (7 * 24 * 60 * 60 * 1000));

    // 3. Attempt Tracking (D-02, D-16)
    if (mode === RunMode.WEEKLY) {
      if (profile.attemptTracking.weekNumber === currentWeek && profile.attemptTracking.weeklyAttemptUsed) {
        return NextResponse.json({ error: 'Weekly One-Shot attempt already used' }, { status: 403 });
      }
      profile.attemptTracking.weekNumber = currentWeek;
      profile.attemptTracking.weeklyAttemptUsed = true;
    } else if (mode === RunMode.DAILY) {
      if (profile.attemptTracking.dayNumber === currentDay && profile.attemptTracking.dailyAttemptUsed) {
        return NextResponse.json({ error: 'Daily Challenge attempt already used' }, { status: 403 });
      }
      profile.attemptTracking.dayNumber = currentDay;
      profile.attemptTracking.dailyAttemptUsed = true;
    }

    await profileRepository.save(profile);

    // 4. Engine Initialization
    const engineConfig = {
      width: 800,
      height: 600,
      seed: config.seed,
      profile,
      sessionId,
      runMode: mode,
    };

    const engine = createEngineInstance(engineConfig);

    sessionManager.createSession(sessionId, {
      world: engine.world,
      grid: engine.grid,
      turnManager: engine.turnManager,
      eventBus: engine.eventBus,
      playerId: engine.playerId,
      systems: engine.systems,
    });

    return NextResponse.json({
      success: true,
      config: {
        mode: config.mode,
        seed: config.seed,
        name: config.name,
      },
    });
  } catch (error) {
    console.error('[RunLaunch] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
