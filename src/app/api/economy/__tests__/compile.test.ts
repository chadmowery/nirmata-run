import { describe, it, expect, beforeEach, vi } from 'vitest';
import { POST } from '../compile/route';
import * as persistence from '../../../../game/systems/profile-persistence';

vi.mock('../../../../game/systems/profile-persistence', () => ({
  loadProfile: vi.fn(),
  saveProfile: vi.fn(),
}));

describe('POST /api/economy/compile', () => {
  const sessionId = 'test-session';
  const blueprintId = 'Phase_Shift.sh';
  
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deducts Flux and adds blueprint to library on success', async () => {
    const mockProfile = {
      sessionId,
      wallet: { scrap: 0, flux: 100 },
      blueprintLibrary: [],
      installedItems: [],
      shellUpgrades: {},
      weekSeed: 0,
      createdAt: Date.now()
    };
    
    (persistence.loadProfile as any).mockResolvedValue(mockProfile);
    
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
    expect(persistence.saveProfile).toHaveBeenCalledWith(expect.objectContaining({
      wallet: { scrap: 0, flux: 50 },
      blueprintLibrary: expect.arrayContaining([
        expect.objectContaining({ blueprintId, type: 'firmware' })
      ])
    }));
  });

  it('returns 400 for insufficient Flux', async () => {
    const mockProfile = {
      sessionId,
      wallet: { scrap: 0, flux: 20 },
      blueprintLibrary: [],
      installedItems: [],
      shellUpgrades: {},
      weekSeed: 0,
      createdAt: Date.now()
    };
    
    (persistence.loadProfile as any).mockResolvedValue(mockProfile);
    
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
    const mockProfile = {
      sessionId,
      wallet: { scrap: 0, flux: 100 },
      blueprintLibrary: [{ blueprintId, type: 'firmware', compiledAt: 123 }],
      installedItems: [],
      shellUpgrades: {},
      weekSeed: 0,
      createdAt: Date.now()
    };
    
    (persistence.loadProfile as any).mockResolvedValue(mockProfile);
    
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
