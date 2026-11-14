import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { POST } from '../route';
import { NextRequest } from 'next/server';
import { reportsRateLimiter } from '@server/reports/rate-limiter';
import { draftStore } from '@server/reports/draft-store';
import { fingerprintIndex, dryRunFingerprintIndex } from '@server/reports/fingerprint-index';
import { setDryRunReportsDirForTesting } from '@server/reports/dry-run';
import { getReportOutbox } from '@server/reports/outbox';

describe('POST /api/reports/crash', () => {
  const origEnv = { ...process.env };
  let testTempDir: string;
  let testLogsDir: string;

  beforeEach(() => {
    process.env = { ...origEnv };
    (process.env as Record<string, string | undefined>).NODE_ENV = 'development';
    testTempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nr-api-crash-'));
    testLogsDir = path.join(testTempDir, 'logs');
    setDryRunReportsDirForTesting(testLogsDir);
    fingerprintIndex.setFilePathForTesting(path.join(testTempDir, 'report-index.json'));
    getReportOutbox().setBaseDirForTesting(path.join(testTempDir, 'outbox'));
    reportsRateLimiter.reset();
    draftStore.clear();
    fingerprintIndex.clear();
    dryRunFingerprintIndex.clear();
  });

  afterEach(() => {
    process.env = origEnv;
    reportsRateLimiter.reset();
    draftStore.clear();
    fingerprintIndex.clear();
    dryRunFingerprintIndex.clear();
    setDryRunReportsDirForTesting(null);
    fingerprintIndex.setFilePathForTesting(path.join(process.cwd(), 'data', 'report-index.json'));
    getReportOutbox().setBaseDirForTesting(null);
    fs.rmSync(testTempDir, { recursive: true, force: true });
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

    const dryRunFile = path.join(testLogsDir, `report-${data.ref}.json`);
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

    const dryRunFile = path.join(testLogsDir, `report-${data.ref}.json`);
    const written = JSON.parse(fs.readFileSync(dryRunFile, 'utf-8')) as { body: string };
    expect(written.body).toContain('`d7770af2`');
    expect(written.body).toContain('Mode `WEEKLY`');
    expect(written.body).toContain('Floor 4');
    expect(written.body).toContain('Turn 212');
    expect(written.body).toContain('Phase `ACTION`');
  });

  it('isolates dry-run index from persistent index and opens Previously: #N issue on 404 in live mode (H-4)', async () => {
    // 1. Dry-run crash must NOT write 99999 into persistent fingerprintIndex
    const dryDraft = draftStore.save({
      sessionId: 'sess_dry_h4',
      fingerprint: 'h4_fp_isolation',
      preview: {
        errorName: 'Error',
        errorMessage: 'Dry run boom',
        actionType: 'MOVE',
        floor: 1,
        turn: 1,
        sealedManifest: [],
      },
      sealed: { errorName: 'Error', errorMessage: 'Dry run boom' },
    });

    const dryRes = await POST(
      new NextRequest('http://localhost:3000/api/reports/crash', {
        method: 'POST',
        body: JSON.stringify({ source: 'SERVER_TURN', draftId: dryDraft.draftId, sessionId: 'sess_dry_h4' }),
      })
    );
    expect(dryRes.status).toBe(200);
    expect(fingerprintIndex.get('h4_fp_isolation')).toBeUndefined();
    expect(dryRunFingerprintIndex.get('h4_fp_isolation')?.issueNumber).toBe(99999);

    // 2. If persistent index points to deleted issue #4040, live 404 creates a new issue noting Previously: #4040
    process.env.GITHUB_ISSUES_ENABLED = 'true';
    process.env.GITHUB_ISSUES_TOKEN = 'ghp_live_h4';
    process.env.GITHUB_ISSUES_REPO = 'owner/repo-h4';

    fingerprintIndex.recordNewIssue('h4_fp_missing', 4040);

    let capturedBody = '';
    const fetchMock = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.includes('/issues/4040')) {
        return {
          ok: false,
          status: 404,
          headers: new Headers(),
          json: async () => ({ message: 'Not Found' }),
        };
      }
      if (url.endsWith('/labels')) {
        return { ok: true, status: 201, headers: new Headers(), json: async () => ({}) };
      }
      if (url.endsWith('/issues')) {
        const parsed = JSON.parse(String(init?.body || '{}')) as { body: string };
        capturedBody = parsed.body;
        return {
          ok: true,
          status: 201,
          headers: new Headers(),
          json: async () => ({
            number: 5001,
            html_url: 'https://github.com/owner/repo-h4/issues/5001',
            labels: [{ name: 'ai-ready' }],
          }),
        };
      }
      return { ok: true, status: 200, headers: new Headers(), json: async () => ({}) };
    });

    const origFetch = globalThis.fetch;
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    try {
      const liveDraft = draftStore.save({
        sessionId: 'sess_live_h4',
        fingerprint: 'h4_fp_missing',
        preview: {
          errorName: 'Error',
          errorMessage: 'Missing issue replacement',
          actionType: 'MOVE',
          floor: 2,
          turn: 10,
          sealedManifest: [],
        },
        sealed: { errorName: 'Error', errorMessage: 'Missing issue replacement' },
      });

      const liveRes = await POST(
        new NextRequest('http://localhost:3000/api/reports/crash', {
          method: 'POST',
          body: JSON.stringify({ source: 'SERVER_TURN', draftId: liveDraft.draftId, sessionId: 'sess_live_h4' }),
        })
      );
      expect(liveRes.status).toBe(200);
      expect((await liveRes.json()).status).toBe('created');
      expect(capturedBody).toContain('Previously: #4040');
      expect(fingerprintIndex.get('h4_fp_missing')?.issueNumber).toBe(5001);
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  it('serializes concurrent same-fingerprint crash submissions so only one issue is created (H-7)', async () => {
    process.env.GITHUB_ISSUES_ENABLED = 'true';
    process.env.GITHUB_ISSUES_TOKEN = 'ghp_live_h7';
    process.env.GITHUB_ISSUES_REPO = 'owner/repo-h7';

    let issueCreateCount = 0;
    const fetchMock = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.includes('/search/issues')) {
        return { ok: true, status: 200, headers: new Headers(), json: async () => ({ items: [] }) };
      }
      if (url.endsWith('/labels')) {
        return { ok: true, status: 201, headers: new Headers(), json: async () => ({}) };
      }
      if (url.endsWith('/issues') && init?.method === 'POST') {
        issueCreateCount++;
        // Simulate GitHub latency so concurrent request overlaps without lock
        await new Promise((r) => setTimeout(r, 25));
        return {
          ok: true,
          status: 201,
          headers: new Headers(),
          json: async () => ({
            number: 700 + issueCreateCount,
            html_url: `https://github.com/owner/repo-h7/issues/${700 + issueCreateCount}`,
            labels: [{ name: 'ai-ready' }],
          }),
        };
      }
      if (url.includes('/issues/701')) {
        return {
          ok: true,
          status: 200,
          headers: new Headers(),
          json: async () => ({ number: 701, state: 'open', title: '[Crash]' }),
        };
      }
      return { ok: true, status: 200, headers: new Headers(), json: async () => ({}) };
    });

    const origFetch = globalThis.fetch;
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    try {
      const draft1 = draftStore.save({
        sessionId: 'sess_h7_a',
        fingerprint: 'h7_shared_fp',
        preview: { errorName: 'Error', errorMessage: 'Concurrent crash', actionType: 'MOVE', floor: 1, turn: 1, sealedManifest: [] },
        sealed: { errorName: 'Error', errorMessage: 'Concurrent crash' },
      });
      const draft2 = draftStore.save({
        sessionId: 'sess_h7_b',
        fingerprint: 'h7_shared_fp',
        preview: { errorName: 'Error', errorMessage: 'Concurrent crash', actionType: 'MOVE', floor: 1, turn: 1, sealedManifest: [] },
        sealed: { errorName: 'Error', errorMessage: 'Concurrent crash' },
      });

      const [res1, res2] = await Promise.all([
        POST(
          new NextRequest('http://localhost:3000/api/reports/crash', {
            method: 'POST',
            body: JSON.stringify({ source: 'SERVER_TURN', draftId: draft1.draftId, sessionId: 'sess_h7_a' }),
          })
        ),
        POST(
          new NextRequest('http://localhost:3000/api/reports/crash', {
            method: 'POST',
            body: JSON.stringify({ source: 'SERVER_TURN', draftId: draft2.draftId, sessionId: 'sess_h7_b' }),
          })
        ),
      ]);

      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);
      const data1 = await res1.json();
      const data2 = await res2.json();
      expect(issueCreateCount).toBe(1);
      expect([data1.status, data2.status].sort()).toEqual(['commented', 'created']);
      expect(fingerprintIndex.get('h7_shared_fp')?.count).toBe(2);
    } finally {
      globalThis.fetch = origFetch;
    }
  });
});
