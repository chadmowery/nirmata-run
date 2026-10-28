import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { submitLeaderboardEntry } from '../../src/server/leaderboard/leaderboard-service';
import { RunMode } from '../../src/game/systems/run-mode-config';
import fs from 'fs/promises';
import path from 'path';

describe('Server Leaderboard Persistence (Phase 4)', () => {
  const sessionId = 'test-leaderboard-session';
  const LEADERBOARD_DIR = path.join(process.cwd(), 'data', 'leaderboards');

  afterEach(async () => {
    // Clean up test leaderboard file
    const now = new Date();
    const periodId = `daily-${Math.floor(now.getTime() / (24 * 60 * 60 * 1000))}`;
    const filePath = path.join(LEADERBOARD_DIR, `${periodId}.json`);
    try {
      await fs.unlink(filePath);
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
});
