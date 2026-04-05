import { describe, it, expect, beforeEach, vi } from 'vitest';
import { POST } from '../compile/route';
import { profileRepository } from '@/app/persistence/fs-profile-repository';

vi.mock('@/app/persistence/fs-profile-repository', () => ({
  profileRepository: {
    load: vi.fn(),
    save: vi.fn(),
  },
}));

describe('POST /api/economy/compile', () => {
  const sessionId = 'test-session';
  const blueprintId = 'Phase_Shift.sh';
  
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createBaseProfile = (overrides = {}) => ({
    sessionId,
    wallet: { scrap: 0, flux: 100 },
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

  it('deducts Flux and adds blueprint to library on success', async () => {
    const mockProfile = createBaseProfile({ wallet: { scrap: 0, flux: 100 } });
    (profileRepository.load as any).mockResolvedValue(mockProfile);
    
    const req = new Request('http://localhost/api/economy/compile', {
      method: 'POST',
      body: JSON.stringify({
        sessionId,
        blueprintId,
        type: 'firmware',
        rarity: 'common'
      })
    });

    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.remainingFlux).toBe(50); // Common cost is 50
    expect(profileRepository.save).toHaveBeenCalledWith(expect.objectContaining({
      wallet: { scrap: 0, flux: 50 },
      blueprintLibrary: expect.arrayContaining([
        expect.objectContaining({ blueprintId, type: 'firmware' })
      ])
    }));
  });

  it('returns 400 for insufficient Flux', async () => {
    const mockProfile = createBaseProfile({ wallet: { scrap: 0, flux: 20 } });
    (profileRepository.load as any).mockResolvedValue(mockProfile);
    
    const req = new Request('http://localhost/api/economy/compile', {
      method: 'POST',
      body: JSON.stringify({
        sessionId,
        blueprintId,
        type: 'firmware',
        rarity: 'common'
      })
    });

    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Insufficient Flux');
  });

  it('returns 400 if already compiled', async () => {
    const mockProfile = createBaseProfile({
      wallet: { scrap: 0, flux: 100 },
      blueprintLibrary: [{ blueprintId, type: 'firmware', compiledAt: 123 }]
    });
    (profileRepository.load as any).mockResolvedValue(mockProfile);
    
    const req = new Request('http://localhost/api/economy/compile', {
      method: 'POST',
      body: JSON.stringify({
        sessionId,
        blueprintId,
        type: 'firmware',
        rarity: 'common'
      })
    });

    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Blueprint already compiled');
  });
});
