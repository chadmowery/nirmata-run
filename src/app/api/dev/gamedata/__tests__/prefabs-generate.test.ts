import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '../prefabs/generate/route';

vi.mock('@/server/security/env-gate', () => ({
  checkNonProductionOnly: vi.fn(() => null),
}));

describe('POST /api/dev/gamedata/prefabs/generate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('generates a valid prefab and structural audit', async () => {
    const req = new Request('http://localhost/api/dev/gamedata/prefabs/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        seed: 'TEST-GEN-1',
        archetype: 'SERVER_CORE',
        faction: 'cyberacme',
        width: 12,
        height: 12,
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.prefab).toBeDefined();
    expect(data.prefab.archetype).toBe('SERVER_CORE');
    expect(data.audit.valid).toBe(true);
    expect(data.audit.errors).toHaveLength(0);
  });

  it('rejects invalid configuration payloads with 400', async () => {
    const req = new Request('http://localhost/api/dev/gamedata/prefabs/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        width: 5, // below min 10
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
