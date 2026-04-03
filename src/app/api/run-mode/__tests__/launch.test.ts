import { describe, it, expect, beforeEach, vi } from 'vitest';
import { POST as launchRoute } from '../launch/route';
import { loadProfile, saveProfile } from '@/game/systems/profile-persistence';
import { createEngineInstance } from '@/game/engine-factory';
import { sessionManager } from '@/engine/session/SessionManager';
import { NextRequest } from 'next/server';

vi.mock('@/game/systems/profile-persistence');
vi.mock('@/engine/session/SessionManager', () => ({
  sessionManager: {
    registerSession: vi.fn()
  }
}));
vi.mock('@/game/engine-factory', () => ({
  createEngineInstance: vi.fn(() => ({
    world: {},
    grid: {},
    turnManager: {},
    eventBus: {},
    systems: {},
    playerId: 1
  }))
}));

describe('Run Launch API', () => {
  const sessionId = 'test-session';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should block launch if overflow is not empty', async () => {
    vi.mocked(loadProfile).mockResolvedValue({
      sessionId,
      overflow: [{ entityId: 1 } as any],
      vault: [],
      attemptTracking: {},
      wallet: { scrap: 0, flux: 0 },
    } as any);

    const req = new NextRequest('http://localhost/api/run-mode/launch', {
      method: 'POST',
      body: JSON.stringify({ sessionId, mode: 'simulation' }),
    });

    const res = await launchRoute(req);
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toContain('Vault overflow');
  });

  it('should track weekly attempts', async () => {
    const profile = {
      sessionId,
      overflow: [],
      vault: [],
      attemptTracking: { weekNumber: 0, weeklyAttemptUsed: false },
      wallet: { scrap: 0, flux: 0 },
    };
    vi.mocked(loadProfile).mockResolvedValue(profile as any);

    const req = new NextRequest('http://localhost/api/run-mode/launch', {
      method: 'POST',
      body: JSON.stringify({ sessionId, mode: 'weekly' }),
    });

    const res = await launchRoute(req);
    expect(res.status).toBe(200);
    expect(vi.mocked(saveProfile)).toHaveBeenCalledWith(expect.objectContaining({
      attemptTracking: expect.objectContaining({ weeklyAttemptUsed: true })
    }));
  });
});
