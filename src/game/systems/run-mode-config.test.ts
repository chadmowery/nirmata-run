import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RunMode } from '@shared/run-mode';
import { getRunModeConfig } from './run-mode-config';
import { getCurrentDailySeed } from '@/app/persistence/seed-rotation';
import fs from 'fs/promises';

vi.mock('@/app/persistence/seed-rotation', async (importOriginal) => {
  const actual = await importOriginal() as any;
  return {
    ...actual,
    getCurrentDailySeed: vi.fn(),
    getCurrentWeeklySeed: vi.fn(),
  };
});

describe('RunModeConfig', () => {
  it('should return simulation config with random seed', async () => {
    const config = await getRunModeConfig(RunMode.SIMULATION);
    expect(config.mode).toBe(RunMode.SIMULATION);
    expect(config.seed).toBeDefined();
    expect(config.attemptsPerPeriod).toBeNull();
  });

  it('should return daily config with shared seed', async () => {
    vi.mocked(getCurrentDailySeed).mockResolvedValue('daily123');
    
    const config = await getRunModeConfig(RunMode.DAILY);
    expect(config.mode).toBe(RunMode.DAILY);
    expect(config.seed).toBe('daily123');
    expect(config.isCompetitive).toBe(true);
  });
});
