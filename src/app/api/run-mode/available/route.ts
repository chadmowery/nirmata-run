import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { profileRepository } from '@/app/persistence/fs-profile-repository';
import { RunMode, getRunModeConfig } from '@/game/systems/run-mode-config';
import { logger } from '@engine/utils/logger';

const AvailableRunModesQuerySchema = z.object({
  sessionId: z.string().min(1),
});

/**
 * GET /api/run-mode/available
 * Returns availability and attempt status for all run modes.
 */
export async function GET(req: NextRequest) {
  const parsed = AvailableRunModesQuerySchema.safeParse({
    sessionId: req.nextUrl.searchParams.get('sessionId'),
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Missing sessionId', details: parsed.error },
      { status: 400 },
    );
  }

  const { sessionId } = parsed.data;

  try {
    const profile = await profileRepository.load(sessionId);
    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const now = new Date();
    const currentDay = Math.floor(now.getTime() / (24 * 60 * 60 * 1000));
    const currentWeek = Math.floor(now.getTime() / (7 * 24 * 60 * 60 * 1000));

    const modes = await Promise.all(
      Object.values(RunMode).map(async (mode) => {
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
          if (
            profile.attemptTracking.weekNumber === currentWeek &&
            profile.attemptTracking.weeklyAttemptUsed
          ) {
            available = false;
            reason = 'WEEKLY_ATTEMPT_USED';
          }
        } else if (mode === RunMode.DAILY) {
          if (
            profile.attemptTracking.dayNumber === currentDay &&
            profile.attemptTracking.dailyAttemptUsed
          ) {
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
          attemptsRemaining: config.attemptsPerPeriod === null ? 'unlimited' : available ? 1 : 0,
        };
      }),
    );

    return NextResponse.json({ modes });
  } catch (error) {
    logger.error('[RunModeAvailable] Error:', 'API', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
