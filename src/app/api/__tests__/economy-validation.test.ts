import { describe, it, expect } from 'vitest';
import { POST as compilePOST } from '../economy/compile/route';
import { POST as installPOST } from '../economy/install/route';
import { POST as upgradePOST } from '../economy/upgrade/route';

describe('Economy API Validation (ECON-05)', () => {
  it('rejects compile request with missing fields', async () => {
    const req = new Request('http://localhost/api/economy/compile', {
      method: 'POST',
      body: JSON.stringify({ sessionId: 'test' }) // Missing blueprintId, type, rarity
    });
    const response = await compilePOST(req);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('Invalid request');
  });

  it('rejects install request with invalid type', async () => {
    const req = new Request('http://localhost/api/economy/install', {
      method: 'POST',
      body: JSON.stringify({
        sessionId: 'test',
        blueprintId: 'b1',
        shellId: 's1',
        type: 'invalid-type'
      })
    });
    const response = await installPOST(req);
    expect(response.status).toBe(400);
  });

  it('rejects upgrade request with invalid stat', async () => {
    const req = new Request('http://localhost/api/economy/upgrade', {
      method: 'POST',
      body: JSON.stringify({
        sessionId: 'test',
        shellId: 's1',
        stat: 'unknown-stat'
      })
    });
    const response = await upgradePOST(req);
    expect(response.status).toBe(400);
  });
});
