import { NextRequest, NextResponse } from 'next/server';
import { RunMode } from '@/game/systems/run-mode-config';
import { submitLeaderboardEntry } from '@/server/leaderboard/leaderboard-service';
import { logger } from '@engine/utils/logger';

export async function POST(req: NextRequest) {
  try {
    const { sessionId, mode, stats } = await req.json();

    if (!sessionId || !mode || !stats) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (mode === RunMode.SIMULATION) {
      return NextResponse.json(
        { error: 'Simulation runs are not eligible for leaderboards' },
        { status: 400 },
      );
    }

    const result = await submitLeaderboardEntry(sessionId, mode, stats);
    if (!result) {
      return NextResponse.json({ error: 'Failed to record leaderboard entry' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      score: result.score,
      rank: result.rank,
    });
  } catch (error) {
    logger.error('[LeaderboardSubmit] Error:', 'API', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
