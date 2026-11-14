import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
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

  it('rejects payloads > 128 KB with 413 and does not consume quota while off or invalid (H-5)', async () => {
    const hugeReq = new NextRequest('http://localhost:3000/api/reports/crash', {
      method: 'POST',
      body: JSON.stringify({ padding: 'x'.repeat(132 * 1024) }),
    });
    const hugeRes = await POST(hugeReq);
    expect(hugeRes.status).toBe(413);

    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
    delete process.env.GITHUB_ISSUES_TOKEN;
    for (let i = 0; i < 45; i++) {
      const offReq = new NextRequest('http://localhost:3000/api/reports/crash', {
        method: 'POST',
        body: JSON.stringify({
          source: 'SERVER_TURN',
          draftId: 'draft-1',
          sessionId: 'sess-1',
        }),
      });
      const offRes = await POST(offReq);
      expect(offRes.status).toBe(503);
    }

    (process.env as Record<string, string | undefined>).NODE_ENV = 'development';
    const validAfter = new NextRequest('http://localhost:3000/api/reports/crash', {
      method: 'POST',
      body: JSON.stringify({
        source: 'SERVER_TURN',
        draftId: 'missing-draft',
        sessionId: 'sess-1',
      }),
    });
    const afterRes = await POST(validAfter);
    expect(afterRes.status).toBe(404);
  });

  it('uses server-stored draft source instead of trusting client source (M-6)', async () => {
    const draft = draftStore.save({
      sessionId: 'sess_m6',
      source: 'SERVER_5XX',
      fingerprint: 'fp_m6_source',
      preview: {
        errorName: 'Error',
        errorMessage: 'Outer failure',
        actionType: 'MOVE',
        floor: 3,
        turn: 10,
        sealedManifest: [],
      },
      sealed: {
        errorName: 'Error',
        errorMessage: 'Outer failure',
      },
    });

    const req = new NextRequest('http://localhost:3000/api/reports/crash', {
      method: 'POST',
      body: JSON.stringify({
        source: 'SERVER_TURN', // Client spoofs SERVER_TURN
        draftId: draft.draftId,
        sessionId: 'sess_m6',
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();

    const dryRunFile = path.join(process.cwd(), 'logs', 'reports', `report-${data.ref}.json`);
    const written = JSON.parse(fs.readFileSync(dryRunFile, 'utf-8')) as { body: string };
    expect(written.body).toContain('Crash (SERVER_5XX)');
    expect(written.body).not.toContain('Crash (SERVER_TURN)');
  });

  it('populates real build, mode, floor, turn, and phase in server-origin issue summaries (H-6)', async () => {
    process.env.NEXT_PUBLIC_BUILD_SHA = 'd7770af2';
    const draft = draftStore.save({
      sessionId: 'sess_h6',
      source: 'SERVER_TURN',
      fingerprint: 'fp_h6_summary',
      preview: {
        errorName: 'TypeError',
        errorMessage: 'Phase fault',
        actionType: 'MOVE',
        floor: 4,
        turn: 212,
        sealedManifest: [],
      },
      sealed: {
        errorName: 'TypeError',
        errorMessage: 'Phase fault',
        mode: 'WEEKLY',
        floor: 4,
        turn: 212,
        phase: 'ACTION',
      },
    });

    const req = new NextRequest('http://localhost:3000/api/reports/crash', {
      method: 'POST',
      body: JSON.stringify({
        source: 'SERVER_TURN',
        draftId: draft.draftId,
        sessionId: 'sess_h6',
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();

    const dryRunFile = path.join(process.cwd(), 'logs', 'reports', `report-${data.ref}.json`);
    const written = JSON.parse(fs.readFileSync(dryRunFile, 'utf-8')) as { body: string };
    expect(written.body).toContain('`d7770af2`');
    expect(written.body).toContain('Mode `WEEKLY`');
    expect(written.body).toContain('Floor 4');
    expect(written.body).toContain('Turn 212');
    expect(written.body).toContain('Phase `ACTION`');
  });
});
