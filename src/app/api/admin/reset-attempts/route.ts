import { NextRequest, NextResponse } from 'next/server';
import { loadProfile, saveProfile } from '@/game/systems/profile-persistence';

/**
 * POST /api/admin/reset-attempts
 * Resets a player's attempt tracking status for daily/weekly modes.
 */
export async function POST(req: NextRequest) {
  try {
    const { sessionId, type } = await req.json();

    if (!sessionId || !type) {
      return NextResponse.json({ error: 'Missing sessionId or type' }, { status: 400 });
    }

    const profile = await loadProfile(sessionId);
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
    } else {
      return NextResponse.json({ error: 'Invalid reset type' }, { status: 400 });
    }

    await saveProfile(profile);

    return NextResponse.json({ success: true, message: `Attempts reset for ${type}` });
  } catch (error) {
    console.error('[AdminResetAttempts] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
