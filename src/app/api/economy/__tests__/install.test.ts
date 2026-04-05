import { describe, it, expect, beforeEach, vi } from 'vitest';
import { POST } from '../install/route';
import { profileRepository } from '@/app/persistence/fs-profile-repository';

vi.mock('@/app/persistence/fs-profile-repository', () => ({
  profileRepository: {
    load: vi.fn(),
    save: vi.fn(),
  },
}));

describe('POST /api/economy/install', () => {
  const sessionId = 'test-session';
  const blueprintId = 'Phase_Shift.sh';
  const shellId = 'striker-v1';
  
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createBaseProfile = (overrides = {}) => ({
    sessionId,
    wallet: { scrap: 100, flux: 0 },
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

  it('deducts Scrap and adds to installedItems on success', async () => {
    const mockProfile = createBaseProfile({
      wallet: { scrap: 100, flux: 0 },
      blueprintLibrary: [{ blueprintId, type: 'firmware', compiledAt: 123 }],
    });
    
    (profileRepository.load as any).mockResolvedValue(mockProfile);
    
    const req = new Request('http://localhost/api/economy/install', {
      method: 'POST',
      body: JSON.stringify({
        sessionId,
        blueprintId,
        shellId,
        type: 'firmware'
      })
    });

    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.remainingScrap).toBe(75); // Firmware cost is 25
    expect(profileRepository.save).toHaveBeenCalledWith(expect.objectContaining({
      wallet: { scrap: 75, flux: 0 },
      installedItems: expect.arrayContaining([
        expect.objectContaining({ blueprintId, shellId, type: 'firmware' })
      ])
    }));
  });

  it('returns 400 if blueprint not compiled', async () => {
    const mockProfile = createBaseProfile({
      wallet: { scrap: 100, flux: 0 },
      blueprintLibrary: [],
    });
    
    (profileRepository.load as any).mockResolvedValue(mockProfile);
    
    const req = new Request('http://localhost/api/economy/install', {
      method: 'POST',
      body: JSON.stringify({
        sessionId,
        blueprintId,
        shellId,
        type: 'firmware'
      })
    });

    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Blueprint not compiled');
  });
});
