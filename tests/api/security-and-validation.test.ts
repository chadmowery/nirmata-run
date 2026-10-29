import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as grantRoute } from '../../src/app/api/admin/grant/route';
import { GET as inspectRoute } from '../../src/app/api/admin/inspect/route';
import { POST as resetRoute } from '../../src/app/api/admin/reset/route';
import { POST as resetAttemptsRoute } from '../../src/app/api/admin/reset-attempts/route';
import { POST as seedRotationRoute } from '../../src/app/api/admin/seed-rotation/route';
import { POST as debugLogRoute } from '../../src/app/api/debug/log/route';
import { POST as sellRoute } from '../../src/app/api/vault/sell/route';
import { POST as discardRoute } from '../../src/app/api/vault/discard/route';
import { POST as moveToVaultRoute } from '../../src/app/api/vault/move-to-vault/route';
import { POST as equipFromVaultRoute } from '../../src/app/api/vault/equip-from-vault/route';
import { GET as overflowRoute } from '../../src/app/api/vault/overflow/route';
import { GET as availableRunModesRoute } from '../../src/app/api/run-mode/available/route';
import { POST as launchRunModeRoute } from '../../src/app/api/run-mode/launch/route';
import { POST as sessionRoute } from '../../src/app/api/session/route';
import { GET as profileRoute } from '../../src/app/api/profile/route';

vi.mock('@/app/persistence/fs-profile-repository', () => ({
  profileRepository: {
    load: vi.fn(),
    save: vi.fn(),
  },
}));

vi.mock('@server/session/session-manager', () => ({
  sessionManager: {
    getSession: vi.fn(),
    createSession: vi.fn(),
  },
}));

describe('API Security & Validation Suite (SEC-02 & SEC-03)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  describe('Environment Gating for Admin & Debug Endpoints (SEC-03)', () => {
    beforeEach(() => {
      vi.stubEnv('NODE_ENV', 'production');
    });

    it('blocks POST /api/admin/grant in production', async () => {
      const req = new NextRequest('http://localhost/api/admin/grant', {
        method: 'POST',
        body: JSON.stringify({ sessionId: 'test', type: 'scrap', amount: 100 }),
      });
      const res = await grantRoute(req);
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toContain('Forbidden: Endpoint disabled in production');
    });

    it('blocks GET /api/admin/inspect in production', async () => {
      const req = new NextRequest('http://localhost/api/admin/inspect?sessionId=test');
      const res = await inspectRoute(req);
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toContain('Forbidden: Endpoint disabled in production');
    });

    it('blocks POST /api/admin/reset in production', async () => {
      const req = new NextRequest('http://localhost/api/admin/reset', {
        method: 'POST',
        body: JSON.stringify({ sessionId: 'test', newWeekSeed: 12345 }),
      });
      const res = await resetRoute(req);
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toContain('Forbidden: Endpoint disabled in production');
    });

    it('blocks POST /api/admin/reset-attempts in production', async () => {
      const req = new NextRequest('http://localhost/api/admin/reset-attempts', {
        method: 'POST',
        body: JSON.stringify({ sessionId: 'test' }),
      });
      const res = await resetAttemptsRoute(req);
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toContain('Forbidden: Endpoint disabled in production');
    });

    it('blocks POST /api/admin/seed-rotation in production', async () => {
      const req = new NextRequest('http://localhost/api/admin/seed-rotation', {
        method: 'POST',
        body: JSON.stringify({ type: 'daily' }),
      });
      const res = await seedRotationRoute(req);
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toContain('Forbidden: Endpoint disabled in production');
    });

    it('blocks POST /api/debug/log in production', async () => {
      const req = new NextRequest('http://localhost/api/debug/log', {
        method: 'POST',
        body: JSON.stringify({ message: 'test' }),
      });
      const res = await debugLogRoute(req);
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toContain('Forbidden: Endpoint disabled in production');
    });
  });

  describe('Zod Request Validation across API Routes (SEC-02)', () => {
    beforeEach(() => {
      vi.stubEnv('NODE_ENV', 'test');
    });

    it('rejects POST /api/vault/sell with invalid body', async () => {
      const req = new NextRequest('http://localhost/api/vault/sell', {
        method: 'POST',
        body: JSON.stringify({ sessionId: 's1' }), // Missing itemId
      });
      const res = await sellRoute(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBeDefined();
    });

    it('rejects POST /api/vault/discard with invalid body', async () => {
      const req = new NextRequest('http://localhost/api/vault/discard', {
        method: 'POST',
        body: JSON.stringify({ sessionId: 's1' }), // Missing itemId
      });
      const res = await discardRoute(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBeDefined();
    });

    it('rejects POST /api/vault/move-to-vault with missing sessionId', async () => {
      const req = new NextRequest('http://localhost/api/vault/move-to-vault', {
        method: 'POST',
        body: JSON.stringify({}), // Missing sessionId
      });
      const res = await moveToVaultRoute(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBeDefined();
    });

    it('rejects POST /api/vault/equip-from-vault with invalid body', async () => {
      const req = new NextRequest('http://localhost/api/vault/equip-from-vault', {
        method: 'POST',
        body: JSON.stringify({ sessionId: 's1' }), // Missing shellId and entityId
      });
      const res = await equipFromVaultRoute(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBeDefined();
    });

    it('rejects GET /api/vault/overflow when sessionId query param is missing', async () => {
      const req = new NextRequest('http://localhost/api/vault/overflow');
      const res = await overflowRoute(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('Missing sessionId');
    });

    it('rejects GET /api/run-mode/available when sessionId query param is missing', async () => {
      const req = new NextRequest('http://localhost/api/run-mode/available');
      const res = await availableRunModesRoute(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('Missing sessionId');
    });

    it('rejects POST /api/run-mode/launch when body is invalid', async () => {
      const req = new NextRequest('http://localhost/api/run-mode/launch', {
        method: 'POST',
        body: JSON.stringify({ sessionId: 's1', mode: 'NOT_A_MODE' }),
      });
      const res = await launchRunModeRoute(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBeDefined();
    });

    it('rejects POST /api/admin/reset-attempts when body is invalid', async () => {
      const req = new NextRequest('http://localhost/api/admin/reset-attempts', {
        method: 'POST',
        body: JSON.stringify({}), // Missing sessionId
      });
      const res = await resetAttemptsRoute(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBeDefined();
    });

    it('rejects POST /api/admin/seed-rotation when body is invalid', async () => {
      const req = new NextRequest('http://localhost/api/admin/seed-rotation', {
        method: 'POST',
        body: JSON.stringify({ type: 'yearly' }), // Invalid enum
      });
      const res = await seedRotationRoute(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBeDefined();
    });

    it('rejects POST /api/session when body is invalid', async () => {
      const req = new Request('http://localhost/api/session', {
        method: 'POST',
        body: JSON.stringify({ seed: 12345 }), // seed must be string
      });
      const res = await sessionRoute(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBeDefined();
    });

    it('rejects GET /api/profile when sessionId is missing', async () => {
      const req = new NextRequest('http://localhost/api/profile');
      const res = await profileRoute(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('Missing sessionId');
    });
  });
});
