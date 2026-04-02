import { describe, it, expect, beforeEach, vi } from 'vitest';
import { POST } from '../reset/route';
import * as persistence from '../../../../game/systems/profile-persistence';

vi.mock('../../../../game/systems/profile-persistence', () => ({
  loadProfile: vi.fn(),
  saveProfile: vi.fn(),
}));

describe('POST /api/admin/reset', () => {
  const sessionId = 'test-session';
  const newWeekSeed = 12345;
  
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('performs weekly reset on success', async () => {
    const mockProfile = {
      sessionId,
      wallet: { scrap: 50000, flux: 5000 },
      blueprintLibrary: [{ blueprintId: 'uninstalled', type: 'firmware', compiledAt: 1 }],
      installedItems: [{ blueprintId: 'installed', type: 'augment', shellId: 's1', isLegacy: false }],
      shellUpgrades: { 's1': { speed: 5 } },
      weekSeed: 11111,
      createdAt: Date.now()
    };
    
    (persistence.loadProfile as any).mockResolvedValue(mockProfile);
    
    const req = new Request('http://localhost/api/admin/reset', {
      method: 'POST',
      body: JSON.stringify({
        sessionId,
        newWeekSeed
      })
    });

    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.wasReset).toBe(true);
    expect(data.blueprintsDeleted).toBe(1);
    expect(data.upgradesReset).toBe(1);
    expect(data.walletAfterCap.scrap).toBe(10000); // Capped
    expect(data.walletAfterCap.flux).toBe(1000); // Capped
    
    expect(persistence.saveProfile).toHaveBeenCalledWith(expect.objectContaining({
      weekSeed: newWeekSeed,
      shellUpgrades: {},
      installedItems: [expect.objectContaining({ blueprintId: 'installed', isLegacy: true })]
    }));
  });

  it('returns success but no reset if already reset for this seed', async () => {
    const mockProfile = {
      sessionId,
      wallet: { scrap: 100, flux: 100 },
      blueprintLibrary: [],
      installedItems: [],
      shellUpgrades: {},
      weekSeed: newWeekSeed,
      createdAt: Date.now()
    };
    
    (persistence.loadProfile as any).mockResolvedValue(mockProfile);
    
    const req = new Request('http://localhost/api/admin/reset', {
      method: 'POST',
      body: JSON.stringify({
        sessionId,
        newWeekSeed
      })
    });

    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.message).toBe('Already reset for this week seed');
    expect(persistence.saveProfile).not.toHaveBeenCalled();
  });
});
