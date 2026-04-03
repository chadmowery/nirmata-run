import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const LEADERBOARD_DIR = path.join(process.cwd(), 'data', 'leaderboards');

export async function GET(req: NextRequest) {
  try {
    const now = new Date();
    const periodId = `weekly-${Math.floor(now.getTime() / (7 * 24 * 60 * 60 * 1000))}`;
    const filePath = path.join(LEADERBOARD_DIR, `${periodId}.json`);

    try {
      const raw = await fs.readFile(filePath, 'utf-8');
      const entries = JSON.parse(raw);
      return NextResponse.json({ entries: entries.slice(0, 50) });
    } catch (e) {
      return NextResponse.json({ entries: [] });
    }
  } catch (error) {
    console.error('[LeaderboardWeekly] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
