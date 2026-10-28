import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  loadSeedRotation,
  saveSeedRotation,
  getCurrentDailySeed,
  getCurrentWeeklySeed,
  rotateSeed,
  getDailyPeriodId,
  getWeeklyPeriodId,
  SeedRotation,
} from '../seed-rotation';
import { profileRepository } from '../fs-profile-repository';
import fs from 'fs/promises';
import path from 'path';

describe('Seed Rotation & Persistence Synchronization', () => {
  const ROTATION_FILE = path.join(process.cwd(), 'data', 'seeds', 'rotation.json');
  let originalRotation: string | null = null;

  beforeEach(async () => {
    try {
      originalRotation = await fs.readFile(ROTATION_FILE, 'utf-8');
    } catch {
      originalRotation = null;
    }
  });

  afterEach(async () => {
    if (originalRotation !== null) {
      await fs.writeFile(ROTATION_FILE, originalRotation, 'utf-8');
    } else {
      try {
        await fs.unlink(ROTATION_FILE);
      } catch {}
    }
  });

  it('calculates deterministic daily and weekly UTC period IDs', () => {
    const t1 = new Date('2026-10-28T00:01:00Z').getTime();
    const t2 = new Date('2026-10-28T23:59:00Z').getTime();
    const t3 = new Date('2026-10-29T00:01:00Z').getTime();

    expect(getDailyPeriodId(t1)).toBe(getDailyPeriodId(t2));
    expect(getDailyPeriodId(t3)).toBe(getDailyPeriodId(t1) + 1);

    const week1 = new Date('2026-10-22T00:00:00Z').getTime();
    const week2 = new Date('2026-10-29T00:00:00Z').getTime();
    expect(getWeeklyPeriodId(week2)).toBe(getWeeklyPeriodId(week1) + 1);
  });

  it('loads and saves seed rotation to disk', async () => {
    const customRotation: SeedRotation = {
      currentDailySeed: 'daily-seed-123',
      currentWeeklySeed: 'weekly-seed-456',
      lastDailyUpdate: Date.now(),
      lastWeeklyUpdate: Date.now(),
    };

    await saveSeedRotation(customRotation);
    const loaded = await loadSeedRotation();

    expect(loaded.currentDailySeed).toBe('daily-seed-123');
    expect(loaded.currentWeeklySeed).toBe('weekly-seed-456');
  });

  it('keeps daily seed within same UTC day and rotates when calendar day advances', async () => {
    const baseTime = new Date('2026-10-28T10:00:00Z').getTime();
    const sameDayLater = new Date('2026-10-28T22:00:00Z').getTime();
    const nextDay = new Date('2026-10-29T01:00:00Z').getTime();

    await saveSeedRotation({
      currentDailySeed: 'stable-seed',
      currentWeeklySeed: 'stable-weekly',
      lastDailyUpdate: baseTime,
      lastWeeklyUpdate: baseTime,
    });

    const seed1 = await getCurrentDailySeed(sameDayLater);
    expect(seed1).toBe('stable-seed');

    const seed2 = await getCurrentDailySeed(nextDay);
    expect(seed2).not.toBe('stable-seed');
    expect(typeof seed2).toBe('string');
  });

  it('rotates weekly seed when calendar week advances', async () => {
    const weekBase = new Date('2026-10-22T12:00:00Z').getTime();
    const nextWeek = new Date('2026-10-29T13:00:00Z').getTime();

    await saveSeedRotation({
      currentDailySeed: 'daily-test',
      currentWeeklySeed: 'old-week',
      lastDailyUpdate: weekBase,
      lastWeeklyUpdate: weekBase,
    });

    const newWeeklySeed = await getCurrentWeeklySeed(nextWeek);
    expect(newWeeklySeed).not.toBe('old-week');
  });

  it('manually rotates daily and weekly seeds via rotateSeed', async () => {
    const initialRotation = await loadSeedRotation();
    const newDaily = await rotateSeed('daily');
    const newWeekly = await rotateSeed('weekly');

    expect(newDaily).not.toBe(initialRotation.currentDailySeed);
    expect(newWeekly).not.toBe(initialRotation.currentWeeklySeed);

    const reloaded = await loadSeedRotation();
    expect(reloaded.currentDailySeed).toBe(newDaily);
    expect(reloaded.currentWeeklySeed).toBe(newWeekly);
  });

  it('sanitizes sessionId against path traversal in FSProfileRepository', async () => {
    await expect(profileRepository.load('../../etc/passwd')).rejects.toThrow(
      'Invalid sessionId',
    );

    await expect(
      profileRepository.save({
        sessionId: '../malicious',
      } as any),
    ).rejects.toThrow('Invalid sessionId');
  });
});
