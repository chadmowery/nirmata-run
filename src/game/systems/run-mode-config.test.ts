import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RunMode, getRunModeConfig } from './run-mode-config';
import { loadSeedRotation, saveSeedRotation, getCurrentDailySeed, getCurrentWeeklySeed } from './seed-rotation';
import fs from 'fs/promises';

vi.mock('fs/promises');

describe('RunModeConfig', () => {
  it('should return simulation config with random seed', async () => {
    const config = await getRunModeConfig(RunMode.SIMULATION);
    expect(config.mode).toBe(RunMode.SIMULATION);
    expect(config.seed).toBeDefined();
    expect(config.attemptsPerPeriod).toBeNull();
  });

  it('should return daily config with shared seed', async () => {
    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({
      currentDailySeed: 'daily123',
      currentWeeklySeed: 'weekly123',
      lastDailyUpdate: Date.now(),
      lastWeeklyUpdate: Date.now()
    }));
    
    const config = await getRunModeConfig(RunMode.DAILY);
    expect(config.mode).toBe(RunMode.DAILY);
    expect(config.seed).toBe('daily123');
    expect(config.isCompetitive).toBe(true);
  });
});

describe('SeedRotation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should rotate daily seed after 24 hours', async () => {
    const oldTime = Date.now() - (25 * 60 * 60 * 1000);
    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({
      currentDailySeed: 'old_daily',
      currentWeeklySeed: 'weekly',
      lastDailyUpdate: oldTime,
      lastWeeklyUpdate: Date.now()
    }));

    const seed = await getCurrentDailySeed();
    expect(seed).not.toBe('old_daily');
    expect(fs.writeFile).toHaveBeenCalled();
  });
});
