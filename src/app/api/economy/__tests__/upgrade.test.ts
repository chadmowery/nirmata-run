import { describe, it, expect, beforeEach, vi } from 'vitest';
import { POST } from '../upgrade/route';
import * as persistence from '../../../../game/systems/profile-persistence';

vi.mock('../../../../game/systems/profile-persistence', () => ({
  loadProfile: vi.fn(),
  saveProfile: vi.fn(),
}));

describe('POST /api/economy/upgrade', () => {
  const sessionId = 'test-session';
  const shellId = 'striker-v1';
  
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deducts Flux and increments level on success', async () => {
    const mockProfile = {
      sessionId,
      wallet: { scrap: 0, flux: 1000 },
      blueprintLibrary: [],
      installedItems: [],
      shellUpgrades: { [shellId]: { speed: 0, armor: 0, stability: 0, additionalPorts: 0 } },
      weekSeed: 0,
      createdAt: Date.now()
    };
    
    (persistence.loadProfile as any).mockResolvedValue(mockProfile);
    
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
    expect(persistence.saveProfile).toHaveBeenCalledWith(expect.objectContaining({
      shellUpgrades: expect.objectContaining({
        [shellId]: expect.objectContaining({ speed: 1 })
      })
    }));
  });

  it('returns 400 for insufficient Flux', async () => {
    const mockProfile = {
      sessionId,
      wallet: { scrap: 0, flux: 10 },
      blueprintLibrary: [],
      installedItems: [],
      shellUpgrades: {},
      weekSeed: 0,
      createdAt: Date.now()
    };
    
    (persistence.loadProfile as any).mockResolvedValue(mockProfile);
    
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
