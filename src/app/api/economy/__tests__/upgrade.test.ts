import { describe, it, expect, beforeEach, vi } from 'vitest';
import { POST } from '../upgrade/route';
import { profileRepository } from '@/app/persistence/fs-profile-repository';

vi.mock('@/app/persistence/fs-profile-repository', () => ({
  profileRepository: {
    load: vi.fn(),
    save: vi.fn(),
  },
}));

describe('POST /api/economy/upgrade', () => {
  const sessionId = 'test-session';
  const shellId = 'striker-v1';
  
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createBaseProfile = (overrides = {}) => ({
    sessionId,
    wallet: { scrap: 0, flux: 1000 },
    blueprintLibrary: [],
    installedItems: [],
    overflow: [],
    vault: [],
    shellUpgrades: {},
    attemptTracking: { dayNumber: 0, weekNumber: 0, dailyAttemptUsed: false, weeklyAttemptUsed: false },
    weekSeed: 0,
    createdAt: Date.now(),
    ...overrides
  });

  it('deducts Flux and increments level on success', async () => {
    const mockProfile = createBaseProfile({
      wallet: { scrap: 0, flux: 1000 },
      shellUpgrades: { [shellId]: { speed: 0, armor: 0, stability: 0, additionalPorts: 0 } },
    });
    
    (profileRepository.load as any).mockResolvedValue(mockProfile);
    
    const req = new Request('http://localhost/api/economy/upgrade', {
      method: 'POST',
      body: JSON.stringify({
        sessionId,
        shellId,
        stat: 'speed'
      })
    });

    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.newLevel).toBe(1);
    expect(data.remainingFlux).toBeLessThan(1000);
    expect(profileRepository.save).toHaveBeenCalledWith(expect.objectContaining({
      shellUpgrades: expect.objectContaining({
        [shellId]: expect.objectContaining({ speed: 1 })
      })
    }));
  });

  it('returns 400 for insufficient Flux', async () => {
    const mockProfile = createBaseProfile({
      wallet: { scrap: 0, flux: 10 },
      shellUpgrades: {},
    });
    
    (profileRepository.load as any).mockResolvedValue(mockProfile);
    
    const req = new Request('http://localhost/api/economy/upgrade', {
      method: 'POST',
      body: JSON.stringify({
        sessionId,
        shellId,
        stat: 'speed'
      })
    });

    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Insufficient Flux');
  });
});
