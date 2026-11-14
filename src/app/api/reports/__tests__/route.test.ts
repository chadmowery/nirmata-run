import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { POST } from '../route';
import { NextRequest } from 'next/server';
import { reportsRateLimiter } from '@/server/reports/rate-limiter';

describe('POST /api/reports', () => {
  const origEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...origEnv };
    (process.env as Record<string, string | undefined>).NODE_ENV = 'development';
    reportsRateLimiter.reset();
  });

  afterEach(() => {
    process.env = origEnv;
    reportsRateLimiter.reset();
  });

  it('rejects invalid request payloads with 400', async () => {
    const req = new NextRequest('http://localhost:3000/api/reports', {
      method: 'POST',
      body: JSON.stringify({ title: 'Short' }), // missing required fields
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('accepts valid manual report and returns dry-run result in dev', async () => {
    const req = new NextRequest('http://localhost:3000/api/reports', {
      method: 'POST',
      body: JSON.stringify({
        kind: 'BUG',
        title: 'Corridor door won\'t open',
        description: 'Interacting with the door failed to open it after turn 12',
        includeDiagnostics: false,
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.status).toBe('dry-run');
    expect(body.ref).toMatch(/^NR-[2-9A-Z]{4}$/);
  });

  it('enforces rate limits with 429 when cap is exceeded', async () => {
    // Consume all slots
    for (let i = 0; i < 20; i++) {
      reportsRateLimiter.consume('manual');
    }

    const req = new NextRequest('http://localhost:3000/api/reports', {
      method: 'POST',
      body: JSON.stringify({
        kind: 'FEATURE',
        title: 'Add quick-turn hotkey',
        description: 'Would love a dedicated 180-degree quick turn hotkey.',
        includeDiagnostics: false,
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(429);
  });

  it('rejects payloads > 128 KB with 413 and does not burn rate limit on invalid/503 requests (H-5)', async () => {
    // 1. 25 invalid requests must not exhaust the 20/hr quota
    for (let i = 0; i < 25; i++) {
      const badReq = new NextRequest('http://localhost:3000/api/reports', {
        method: 'POST',
        body: JSON.stringify({ title: 'bad' }),
      });
      const badRes = await POST(badReq);
      expect(badRes.status).toBe(400);
    }

    // 2. Oversized body (> 128 KB) returns 413
    const hugeReq = new NextRequest('http://localhost:3000/api/reports', {
      method: 'POST',
      body: JSON.stringify({
        kind: 'BUG',
        title: 'Valid title here',
        description: 'a'.repeat(132 * 1024),
        includeDiagnostics: false,
      }),
    });
    const hugeRes = await POST(hugeReq);
    expect(hugeRes.status).toBe(413);

    // 3. Valid request still succeeds (quota was not consumed by 400/413)
    const okReq = new NextRequest('http://localhost:3000/api/reports', {
      method: 'POST',
      body: JSON.stringify({
        kind: 'BUG',
        title: 'Valid title after invalid spam',
        description: 'Valid description after invalid spam.',
        includeDiagnostics: false,
      }),
    });
    const okRes = await POST(okReq);
    expect(okRes.status).toBe(200);
  });
});
