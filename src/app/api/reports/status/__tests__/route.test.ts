import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GET } from '../route';

describe('GET /api/reports/status', () => {
  const origEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...origEnv };
  });

  afterEach(() => {
    process.env = origEnv;
  });

  it('returns reports status response', async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = 'development';
    delete process.env.GITHUB_ISSUES_TOKEN;
    const res = await GET();
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data).toEqual({ available: true, mode: 'dry-run' });
  });
});
