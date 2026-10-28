import fs from 'fs/promises';
import path from 'path';

export interface SeedRotation {
  currentDailySeed: string;
  currentWeeklySeed: string;
  lastDailyUpdate: number; // Timestamp
  lastWeeklyUpdate: number; // Timestamp
}

const ROTATION_FILE = path.join(process.cwd(), 'data', 'seeds', 'rotation.json');

/**
 * Computes calendar day index aligned with UTC midnight boundaries.
 */
export function getDailyPeriodId(timestamp = Date.now()): number {
  return Math.floor(timestamp / (24 * 60 * 60 * 1000));
}

/**
 * Computes calendar week index aligned with UTC weekly boundaries.
 */
export function getWeeklyPeriodId(timestamp = Date.now()): number {
  return Math.floor(timestamp / (7 * 24 * 60 * 60 * 1000));
}

/**
 * Loads the current seed rotation from disk.
 * Returns defaults and persists them if file not found.
 */
export async function loadSeedRotation(): Promise<SeedRotation> {
  try {
    const raw = await fs.readFile(ROTATION_FILE, 'utf-8');
    return JSON.parse(raw);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    const defaultRotation: SeedRotation = {
      currentDailySeed: Math.random().toString(36).substring(2, 10),
      currentWeeklySeed: Math.random().toString(36).substring(2, 10),
      lastDailyUpdate: Date.now(),
      lastWeeklyUpdate: Date.now(),
    };
    try {
      await saveSeedRotation(defaultRotation);
    } catch {
      // Ignore save errors on read-only environments
    }
    return defaultRotation;
  }
}

/**
 * Saves the seed rotation to disk.
 */
export async function saveSeedRotation(rotation: SeedRotation): Promise<void> {
  await fs.mkdir(path.dirname(ROTATION_FILE), { recursive: true });
  await fs.writeFile(ROTATION_FILE, JSON.stringify(rotation, null, 2), 'utf-8');
}

/**
 * Gets the current daily seed, rotating when the UTC calendar day advances.
 */
export async function getCurrentDailySeed(now = Date.now()): Promise<string> {
  const rotation = await loadSeedRotation();

  if (getDailyPeriodId(now) !== getDailyPeriodId(rotation.lastDailyUpdate)) {
    rotation.currentDailySeed = Math.random().toString(36).substring(2, 10);
    rotation.lastDailyUpdate = now;
    await saveSeedRotation(rotation);
  }

  return rotation.currentDailySeed;
}

/**
 * Gets the current weekly seed, rotating when the UTC calendar week advances.
 */
export async function getCurrentWeeklySeed(now = Date.now()): Promise<string> {
  const rotation = await loadSeedRotation();

  if (getWeeklyPeriodId(now) !== getWeeklyPeriodId(rotation.lastWeeklyUpdate)) {
    rotation.currentWeeklySeed = Math.random().toString(36).substring(2, 10);
    rotation.lastWeeklyUpdate = now;
    await saveSeedRotation(rotation);
  }

  return rotation.currentWeeklySeed;
}

/**
 * Manually rotates a seed (admin tool).
 */
export async function rotateSeed(type: 'daily' | 'weekly'): Promise<string> {
  const rotation = await loadSeedRotation();
  const newSeed = Math.random().toString(36).substring(2, 10);
  const now = Date.now();

  if (type === 'daily') {
    rotation.currentDailySeed = newSeed;
    rotation.lastDailyUpdate = now;
  } else {
    rotation.currentWeeklySeed = newSeed;
    rotation.lastWeeklyUpdate = now;
  }

  await saveSeedRotation(rotation);
  return newSeed;
}
