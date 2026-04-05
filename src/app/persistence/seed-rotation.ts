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
 * Loads the current seed rotation from disk.
 * Returns defaults if file not found.
 */
export async function loadSeedRotation(): Promise<SeedRotation> {
  try {
    const raw = await fs.readFile(ROTATION_FILE, 'utf-8');
    return JSON.parse(raw);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    // If folder doesn't exist, it will be created on save
    return {
      currentDailySeed: Math.random().toString(36).substring(2, 10),
      currentWeeklySeed: Math.random().toString(36).substring(2, 10),
      lastDailyUpdate: Date.now(),
      lastWeeklyUpdate: Date.now(),
    };
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
 * Gets the current daily seed, rotating if 24h have passed.
 */
export async function getCurrentDailySeed(): Promise<string> {
  const rotation = await loadSeedRotation();
  const now = Date.now();
  const ONE_DAY = 24 * 60 * 60 * 1000;

  if (now - rotation.lastDailyUpdate >= ONE_DAY) {
    rotation.currentDailySeed = Math.random().toString(36).substring(2, 10);
    rotation.lastDailyUpdate = now;
    await saveSeedRotation(rotation);
  }

  return rotation.currentDailySeed;
}

/**
 * Gets the current weekly seed, rotating if 7 days have passed.
 */
export async function getCurrentWeeklySeed(): Promise<string> {
  const rotation = await loadSeedRotation();
  const now = Date.now();
  const ONE_WEEK = 7 * 24 * 60 * 60 * 1000;

  if (now - rotation.lastWeeklyUpdate >= ONE_WEEK) {
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
