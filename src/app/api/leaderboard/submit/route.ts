import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { calculateScore, RunMode } from '@/game/systems/run-mode-config';

const LEADERBOARD_DIR = path.join(process.cwd(), 'data', 'leaderboards');

export async function POST(req: NextRequest) {
  try {
    const { sessionId, mode, stats } = await req.json();

    if (!sessionId || !mode || !stats) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (mode === RunMode.SIMULATION) {
      return NextResponse.json({ error: 'Simulation runs are not eligible for leaderboards' }, { status: 400 });
    }

    // 1. Calculate Score Server-Side (D-21)
    const score = calculateScore({
      floorNumber: stats.floorNumber || 0,
      scrapExtracted: stats.scrapExtracted || 0,
      softwareExtracted: stats.softwareExtracted || 0,
      fluxExtracted: stats.fluxExtracted || 0,
    });

    // 2. Determine Period File
    const now = new Date();
    const periodId = mode === RunMode.DAILY
      ? `daily-${Math.floor(now.getTime() / (24 * 60 * 60 * 1000))}`
      : `weekly-${Math.floor(now.getTime() / (7 * 24 * 60 * 60 * 1000))}`;

    const filePath = path.join(LEADERBOARD_DIR, `${periodId}.json`);
    await fs.mkdir(LEADERBOARD_DIR, { recursive: true });

    let entries = [];
    try {
      const raw = await fs.readFile(filePath, 'utf-8');
      entries = JSON.parse(raw);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
      // New period
    }

    // 3. Update or Add Entry
    const existingIndex = entries.findIndex((e: any) => e.sessionId === sessionId);
    if (existingIndex !== -1) {
      // Only keep best score for the period
      if (score > entries[existingIndex].score) {
        entries[existingIndex] = { sessionId, score, timestamp: Date.now(), stats };
      }
    } else {
      entries.push({ sessionId, score, timestamp: Date.now(), stats });
    }

    // Sort and Save
    entries.sort((a: any, b: any) => b.score - a.score);
    await fs.writeFile(filePath, JSON.stringify(entries, null, 2), 'utf-8');

    return NextResponse.json({ success: true, score, rank: entries.findIndex((e: any) => e.sessionId === sessionId) + 1 });
  } catch (error) {
    console.error('[LeaderboardSubmit] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
