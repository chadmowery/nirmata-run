import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET as getConfigs } from '../configs/route';
import { GET as getConfig, PUT as putConfig } from '../configs/[name]/route';

vi.mock('@/server/security/env-gate', () => ({
  checkNonProductionOnly: vi.fn(() => null),
}));

describe('Configs API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists available system configs', async () => {
    const res = await getConfigs();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.items).toEqual(['economy', 'depth-config', 'loot-distribution']);
  });

  it('reads economy config', async () => {
    const req = new Request('http://localhost/api/dev/gamedata/configs/economy');
    const res = await getConfig(req, { params: Promise.resolve({ name: 'economy' }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.version).toBeDefined();
    expect(data.currencyDrops).toBeDefined();
    expect(data.costs).toBeDefined();
  });

  it('reads depth-config', async () => {
    const req = new Request('http://localhost/api/dev/gamedata/configs/depth-config');
    const res = await getConfig(req, { params: Promise.resolve({ name: 'depth-config' }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.depthBands).toBeDefined();
  });

  it('reads loot-distribution', async () => {
    const req = new Request('http://localhost/api/dev/gamedata/configs/loot-distribution');
    const res = await getConfig(req, { params: Promise.resolve({ name: 'loot-distribution' }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.depthBands).toBeDefined();
  });

  it('returns 404 for unknown config', async () => {
    const req = new Request('http://localhost/api/dev/gamedata/configs/unknown');
    const res = await getConfig(req, { params: Promise.resolve({ name: 'unknown' }) });
    expect(res.status).toBe(404);
  });

  it('rejects invalid payload on PUT with 400', async () => {
    const req = new Request('http://localhost/api/dev/gamedata/configs/economy', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invalid: true }),
    });
    const res = await putConfig(req, { params: Promise.resolve({ name: 'economy' }) });
    expect(res.status).toBe(400);
  });
});
