import { describe, it, expect, beforeEach, vi } from 'vitest';
import { POST as sessionRoute } from '../../src/app/api/session/route';
import { profileRepository } from '@/app/persistence/fs-profile-repository';
import { sessionManager } from '@server/session/session-manager';
import { createEngineInstance } from '@/game/engine-factory';
import { RunMode } from '@shared/run-mode';

vi.mock('@/app/persistence/fs-profile-repository');
vi.mock('@server/session/session-manager', () => ({
  sessionManager: {
    createSession: vi.fn(),
  },
}));
vi.mock('@/game/engine-factory', () => ({
  createEngineInstance: vi.fn(() => ({
    world: {},
    grid: {},
    turnManager: { start: vi.fn() },
    eventBus: {},
    systems: {},
    playerId: 1,
  })),
}));

describe('Session Security & Mode Restrictions (Phase 4)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects launching weekly or daily competitive runs via /api/session', async () => {
    const weeklyReq = new Request('http://localhost/api/session', {
      method: 'POST',
      body: JSON.stringify({
        seed: 'test-seed',
        mode: RunMode.WEEKLY,
      }),
    });

    const weeklyRes = await sessionRoute(weeklyReq);
    expect(weeklyRes.status).toBe(403);
    const weeklyData = await weeklyRes.json();
    expect(weeklyData.error).toContain('Competitive modes (weekly/daily) must be launched via /api/run-mode/launch');

    const dailyReq = new Request('http://localhost/api/session', {
      method: 'POST',
      body: JSON.stringify({
        seed: 'test-seed',
        mode: RunMode.DAILY,
      }),
    });

    const dailyRes = await sessionRoute(dailyReq);
    expect(dailyRes.status).toBe(403);
  });

  it('creates practice sessions with RunMode.SIMULATION', async () => {
    vi.mocked(profileRepository.load).mockResolvedValue({
      sessionId: 'practice-session',
      vault: [],
      installedItems: [],
      wallet: { scrap: 0, flux: 0 },
    } as any);

    const req = new Request('http://localhost/api/session', {
      method: 'POST',
      body: JSON.stringify({
        seed: 'practice-seed',
        sessionId: 'practice-session',
      }),
    });

    const res = await sessionRoute(req);
    expect(res.status).toBe(200);

    expect(sessionManager.createSession).toHaveBeenCalledWith(
      'practice-session',
      expect.objectContaining({
        runMode: RunMode.SIMULATION,
      }),
    );
  });
});
