import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { profileRepository } from '@/app/persistence/fs-profile-repository';
import { checkNonProductionOnly } from '@/server/security/env-gate';
import { logger } from '@engine/utils/logger';

const ResetAttemptsRequestSchema = z.object({
  sessionId: z.string().min(1),
  type: z.enum(['daily', 'weekly', 'all']),
});

/**
 * POST /api/admin/reset-attempts
 * Resets a player's attempt tracking status for daily/weekly modes.
 */
export async function POST(req: NextRequest) {
  const envBlocked = checkNonProductionOnly();
  if (envBlocked) return envBlocked;

  try {
    const body = await req.json();
    const result = ResetAttemptsRequestSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: result.error },
        { status: 400 },
      );
    }

    const { sessionId, type } = result.data;

    const profile = await profileRepository.load(sessionId);
    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    if (type === 'daily') {
      profile.attemptTracking.dailyAttemptUsed = false;
    } else if (type === 'weekly') {
      profile.attemptTracking.weeklyAttemptUsed = false;
    } else if (type === 'all') {
      profile.attemptTracking.dailyAttemptUsed = false;
      profile.attemptTracking.weeklyAttemptUsed = false;
    }

    await profileRepository.save(profile);

    return NextResponse.json({ success: true, message: `Attempts reset for ${type}` });
  } catch (error) {
    logger.error('[AdminResetAttempts] Error:', 'API', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
