import { describe, it, expect, beforeEach, vi } from 'vitest';
import { POST } from '../install/route';
import * as persistence from '../../../../game/systems/profile-persistence';

vi.mock('../../../../game/systems/profile-persistence', () => ({
  loadProfile: vi.fn(),
  saveProfile: vi.fn(),
}));

describe('POST /api/economy/install', () => {
  const sessionId = 'test-session';
  const blueprintId = 'Phase_Shift.sh';
  const shellId = 'striker-v1';
  
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deducts Scrap and adds to installedItems on success', async () => {
    const mockProfile = {
      sessionId,
      wallet: { scrap: 100, flux: 0 },
      blueprintLibrary: [{ blueprintId, type: 'firmware', compiledAt: 123 }],
      installedItems: [],
      shellUpgrades: {},
      weekSeed: 0,
      createdAt: Date.now()
    };
    
    (persistence.loadProfile as any).mockResolvedValue(mockProfile);
    
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
    expect(persistence.saveProfile).toHaveBeenCalledWith(expect.objectContaining({
      wallet: { scrap: 75, flux: 0 },
      installedItems: expect.arrayContaining([
        expect.objectContaining({ blueprintId, shellId, type: 'firmware' })
      ])
    }));
  });

  it('returns 400 if blueprint not compiled', async () => {
    const mockProfile = {
      sessionId,
      wallet: { scrap: 100, flux: 0 },
      blueprintLibrary: [],
      installedItems: [],
      shellUpgrades: {},
      weekSeed: 0,
      createdAt: Date.now()
    };
    
    (persistence.loadProfile as any).mockResolvedValue(mockProfile);
    
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
