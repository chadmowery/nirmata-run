import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { POST } from '../route';
import { NextRequest } from 'next/server';
import { reportsRateLimiter } from '@/server/reports/rate-limiter';
import { draftStore } from '@/server/reports/draft-store';
import { fingerprintIndex } from '@/server/reports/fingerprint-index';

describe('POST /api/reports/crash', () => {
  const origEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...origEnv };
    (process.env as Record<string, string | undefined>).NODE_ENV = 'development';
    reportsRateLimiter.reset();
    draftStore.clear();
    fingerprintIndex.clear();
  });

  afterEach(() => {
    process.env = origEnv;
    reportsRateLimiter.reset();
    draftStore.clear();
    fingerprintIndex.clear();
  });

  it('returns 404 when server crash draft is missing or expired', async () => {
    const req = new NextRequest('http://localhost:3000/api/reports/crash', {
      method: 'POST',
      body: JSON.stringify({
        source: 'SERVER_TURN',
        draftId: 'non-existent-draft-id',
        sessionId: 'sess_123',
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(404);
  });

  it('approves server crash draft and returns report reference', async () => {
    const draft = draftStore.save({
      sessionId: 'sess_valid',
      fingerprint: 'fp_server_crash',
      preview: {
        errorName: 'TypeError',
        errorMessage: 'Invalid entity reference',
        actionType: 'MOVE',
        floor: 1,
        turn: 4,
        sealedManifest: [{ label: 'Player Data', approxBytes: 50 }],
      },
      sealed: {
        errorName: 'TypeError',
        errorMessage: 'Invalid entity reference',
        runSeed: 9999,
      },
    });

    const req = new NextRequest('http://localhost:3000/api/reports/crash', {
      method: 'POST',
      body: JSON.stringify({
        source: 'SERVER_TURN',
        draftId: draft.draftId,
        sessionId: 'sess_valid',
        note: 'Stepped onto a trap and game froze',
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.status).toBe('dry-run');
    expect(data.ref).toMatch(/^NR-[2-9A-Z]{4}$/);

    // Verifies single-use redemption: draft is consumed
    expect(draftStore.get(draft.draftId)).toBeUndefined();
  });

  it('accepts client-origin crashes with diagnostics and recomputed fingerprint', async () => {
    const payload = {
      source: 'CLIENT_ERROR',
      fingerprint: '0123456789abcdef',
      error: {
        name: 'ReferenceError',
        message: 'hudElement is not defined',
        stack: 'at renderHud (/app/page.js:10:5)',
      },
      diagnostics: {
        build: 'test-build',
        route: '/game',
        userAgent: 'TestBrowser',
        viewport: { w: 1024, h: 768 },
        gameStatus: 'IN_RUN',
        floor: 2,
        turn: 20,
        recentLogs: [],
        recentActions: [],
        recentMessages: [],
      },
    };

    const req = new NextRequest('http://localhost:3000/api/reports/crash', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe('dry-run');
    expect(data.ref).toBeDefined();
  });
});
