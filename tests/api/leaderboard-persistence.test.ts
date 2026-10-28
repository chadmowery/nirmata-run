import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { submitLeaderboardEntry } from '../../src/server/leaderboard/leaderboard-service';
import { GET as dailyLeaderboardRoute } from '../../src/app/api/leaderboard/daily/route';
import { GET as weeklyLeaderboardRoute } from '../../src/app/api/leaderboard/weekly/route';
import { RunMode } from '../../src/game/systems/run-mode-config';
import fs from 'fs/promises';
import path from 'path';

describe('Server Leaderboard Persistence (Phase 4)', () => {
  const sessionId = 'test-leaderboard-session';
  const LEADERBOARD_DIR = path.join(process.cwd(), 'data', 'leaderboards');

  afterEach(async () => {
    // Clean up test leaderboard files
    const now = new Date();
    const dailyId = `daily-${Math.floor(now.getTime() / (24 * 60 * 60 * 1000))}`;
    const weeklyId = `weekly-${Math.floor(now.getTime() / (7 * 24 * 60 * 60 * 1000))}`;
    try {
      await fs.unlink(path.join(LEADERBOARD_DIR, `${dailyId}.json`));
    } catch {}
    try {
      await fs.unlink(path.join(LEADERBOARD_DIR, `${weeklyId}.json`));
    } catch {}
  });

  it('rejects simulation runs from competitive leaderboards', async () => {
    const result = await submitLeaderboardEntry(sessionId, RunMode.SIMULATION, {
      floorNumber: 5,
      scrapExtracted: 200,
      softwareExtracted: 2,
      fluxExtracted: 50,
    });

    expect(result).toBeNull();
  });

  it('calculates score and persists entry for daily competitive mode', async () => {
    const result = await submitLeaderboardEntry(sessionId, RunMode.DAILY, {
      floorNumber: 5,
      scrapExtracted: 200,
      softwareExtracted: 2,
      fluxExtracted: 50,
    });

    expect(result).not.toBeNull();
    expect(result?.score).toBeGreaterThan(0);
    expect(result?.rank).toBe(1);

    // Verify file content
    const now = new Date();
    const periodId = `daily-${Math.floor(now.getTime() / (24 * 60 * 60 * 1000))}`;
    const filePath = path.join(LEADERBOARD_DIR, `${periodId}.json`);

    const raw = await fs.readFile(filePath, 'utf-8');
    const entries = JSON.parse(raw);

    expect(entries).toHaveLength(1);
    expect(entries[0].sessionId).toBe(sessionId);
    expect(entries[0].score).toBe(result?.score);
  });

  it('serves daily and weekly leaderboard entries via GET endpoints', async () => {
    // Submit daily entry
    await submitLeaderboardEntry(sessionId, RunMode.DAILY, {
      floorNumber: 5,
      scrapExtracted: 200,
      softwareExtracted: 2,
      fluxExtracted: 50,
    });

    const dailyReq = new Request('http://localhost/api/leaderboard/daily');
    const dailyRes = await dailyLeaderboardRoute(dailyReq as any);
    expect(dailyRes.status).toBe(200);
    const dailyData = await dailyRes.json();
    expect(dailyData.entries).toHaveLength(1);
    expect(dailyData.entries[0].sessionId).toBe(sessionId);

    // Empty weekly returns empty array
    const weeklyReq = new Request('http://localhost/api/leaderboard/weekly');
    const weeklyRes = await weeklyLeaderboardRoute(weeklyReq as any);
    expect(weeklyRes.status).toBe(200);
    const weeklyData = await weeklyRes.json();
    expect(weeklyData.entries).toEqual([]);
  });
});
