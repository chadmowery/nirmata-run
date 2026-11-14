import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { POST } from '../route';
import { NextRequest } from 'next/server';
import { reportsRateLimiter } from '@server/reports/rate-limiter';
import { getReportOutbox } from '@server/reports/outbox';
import { setDryRunReportsDirForTesting } from '@server/reports/dry-run';

describe('POST /api/reports', () => {
  const origEnv = { ...process.env };
  let tempDir: string;

  beforeEach(() => {
    process.env = { ...origEnv };
    (process.env as Record<string, string | undefined>).NODE_ENV = 'development';
    reportsRateLimiter.reset();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nr-api-reports-'));
    setDryRunReportsDirForTesting(path.join(tempDir, 'logs'));
    getReportOutbox().setBaseDirForTesting(path.join(tempDir, 'outbox'));
  });

  afterEach(() => {
    process.env = origEnv;
    reportsRateLimiter.reset();
    setDryRunReportsDirForTesting(null);
    getReportOutbox().setBaseDirForTesting(null);
    fs.rmSync(tempDir, { recursive: true, force: true });
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

  it('queues retryable rate-limit failures and rejects permanent 4xx errors without queuing (L-5)', async () => {
    process.env.GITHUB_ISSUES_ENABLED = 'true';
    process.env.GITHUB_ISSUES_TOKEN = 'ghp_live_test_l5';
    process.env.GITHUB_ISSUES_REPO = 'owner/repo-l5';

    const fetchMock = vi
      .fn()
      // Request 1: ensureLabels succeeds (2 calls), createIssue hits 429 -> queued
      .mockResolvedValueOnce({ ok: true, status: 201, headers: new Headers(), json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, status: 201, headers: new Headers(), json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, status: 201, headers: new Headers(), json: async () => ({}) })
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: new Headers({ 'retry-after': '30' }),
        json: async () => ({ message: 'rate limit' }),
      })
      // Request 2: labels cached, createIssue hits permanent 422 -> 502, not queued
      .mockResolvedValueOnce({
        ok: false,
        status: 422,
        headers: new Headers(),
        json: async () => ({ message: 'Validation Failed' }),
      });

    const origFetch = globalThis.fetch;
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const enqueueSpy = vi.spyOn(getReportOutbox(), 'enqueue').mockImplementation((item) => ({
      ...item,
      attempts: 0,
      nextAttemptAt: 0,
      createdAt: Date.now(),
    }));

    try {
      const req1 = new NextRequest('http://localhost:3000/api/reports', {
        method: 'POST',
        body: JSON.stringify({
          kind: 'BUG',
          title: 'Rate limit queue test',
          description: 'Testing transient rate limit queuing behavior.',
          includeDiagnostics: false,
        }),
      });
      const res1 = await POST(req1);
      expect(res1.status).toBe(200);
      expect((await res1.json()).status).toBe('queued');
      expect(enqueueSpy).toHaveBeenCalledTimes(1);

      const req2 = new NextRequest('http://localhost:3000/api/reports', {
        method: 'POST',
        body: JSON.stringify({
          kind: 'BUG',
          title: 'Permanent error test',
          description: 'Testing permanent 4xx rejection without queuing.',
          includeDiagnostics: false,
        }),
      });
      const res2 = await POST(req2);
      expect(res2.status).toBe(502);
      expect(enqueueSpy).toHaveBeenCalledTimes(1);
    } finally {
      enqueueSpy.mockRestore();
      globalThis.fetch = origFetch;
    }
  });

  it('deduplicates repeated manual submissions with the same idempotencyKey without creating duplicates (M-10)', async () => {
    const payload = {
      kind: 'BUG',
      title: 'Double submit protection check',
      description: 'Clicking submit rapidly should only produce a single report reference.',
      includeDiagnostics: false,
      idempotencyKey: '550e8400-e29b-41d4-a716-446655440000',
    };

    const res1 = await POST(
      new NextRequest('http://localhost:3000/api/reports', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
    );
    const res2 = await POST(
      new NextRequest('http://localhost:3000/api/reports', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
    );

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
    const body1 = await res1.json();
    const body2 = await res2.json();
    expect(body2.ref).toBe(body1.ref);
    expect(body2.status).toBe(body1.status);
  });
});
