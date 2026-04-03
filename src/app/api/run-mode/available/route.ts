import { NextRequest, NextResponse } from 'next/server';
import { loadProfile } from '@/game/systems/profile-persistence';
import { RunMode, getRunModeConfig } from '@/game/systems/run-mode-config';

/**
 * GET /api/run-mode/available
 * Returns availability and attempt status for all run modes.
 */
export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get('sessionId');
  if (!sessionId) {
    return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });
  }

  try {
    const profile = await loadProfile(sessionId);
    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const now = new Date();
    const currentDay = Math.floor(now.getTime() / (24 * 60 * 60 * 1000));
    const currentWeek = Math.floor(now.getTime() / (7 * 24 * 60 * 60 * 1000));

    const modes = await Promise.all(Object.values(RunMode).map(async (mode) => {
      const config = await getRunModeConfig(mode);
      let available = true;
      let reason = null;

      // Check overflow
      if (profile.overflow.length > 0) {
        available = false;
        reason = 'VAULT_OVERFLOW';
      }

      // Check attempt tracking
      if (mode === RunMode.WEEKLY) {
        if (profile.attemptTracking.weekNumber === currentWeek && profile.attemptTracking.weeklyAttemptUsed) {
          available = false;
          reason = 'WEEKLY_ATTEMPT_USED';
        }
      } else if (mode === RunMode.DAILY) {
        if (profile.attemptTracking.dayNumber === currentDay && profile.attemptTracking.dailyAttemptUsed) {
          available = false;
          reason = 'DAILY_ATTEMPT_USED';
        }
      }

      return {
        mode,
        name: config.name,
        description: config.description,
        available,
        reason,
        attemptsRemaining: config.attemptsPerPeriod === null ? 'unlimited' : (available ? 1 : 0),
      };
    }));

    return NextResponse.json({ modes });
  } catch (error) {
    console.error('[RunModeAvailable] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
