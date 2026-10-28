import fs from 'fs/promises';
import path from 'path';
import { calculateScore } from '@/game/scoring';
import { RunMode } from '@shared/run-mode';
import { logger } from '@engine/utils/logger';

const LEADERBOARD_DIR = path.join(process.cwd(), 'data', 'leaderboards');

export interface LeaderboardEntry {
  sessionId: string;
  score: number;
  timestamp: number;
  stats?: unknown;
}

export interface SubmitLeaderboardResult {
  score: number;
  rank: number;
}

/**
 * Authoritatively calculates and persists a score to the period leaderboard.
 */
export async function submitLeaderboardEntry(
  sessionId: string,
  mode: RunMode,
  stats: {
    floorNumber: number;
    scrapExtracted: number;
    softwareExtracted: number;
    fluxExtracted: number;
  },
): Promise<SubmitLeaderboardResult | null> {
  if (mode === RunMode.SIMULATION) {
    return null;
  }

  const score = calculateScore({
    floorNumber: stats.floorNumber || 0,
    scrapExtracted: stats.scrapExtracted || 0,
    softwareExtracted: stats.softwareExtracted || 0,
    fluxExtracted: stats.fluxExtracted || 0,
  });

  const now = new Date();
  const periodId =
    mode === RunMode.DAILY
      ? `daily-${Math.floor(now.getTime() / (24 * 60 * 60 * 1000))}`
      : `weekly-${Math.floor(now.getTime() / (7 * 24 * 60 * 60 * 1000))}`;

  const filePath = path.join(LEADERBOARD_DIR, `${periodId}.json`);

  try {
    await fs.mkdir(LEADERBOARD_DIR, { recursive: true });

    let entries: LeaderboardEntry[] = [];
    try {
      const raw = await fs.readFile(filePath, 'utf-8');
      entries = JSON.parse(raw);
    } catch {
      // New period file
    }

    const existingIndex = entries.findIndex((e) => e.sessionId === sessionId);
    if (existingIndex !== -1) {
      if (score > entries[existingIndex].score) {
        entries[existingIndex] = { sessionId, score, timestamp: Date.now(), stats };
      }
    } else {
      entries.push({ sessionId, score, timestamp: Date.now(), stats });
    }

    entries.sort((a, b) => b.score - a.score);
    await fs.writeFile(filePath, JSON.stringify(entries, null, 2), 'utf-8');

    const rank = entries.findIndex((e) => e.sessionId === sessionId) + 1;
    logger.info(`[Leaderboard] Submitted score for ${sessionId}: ${score} (Rank: ${rank})`, 'API');

    return { score, rank };
  } catch (error) {
    logger.error('[Leaderboard] Submission failed:', 'API', error);
    return null;
  }
}
