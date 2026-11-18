import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GET, POST } from '../route';
import { sessionManager } from '@server/session/session-manager';

// Mock NextResponse
vi.mock('next/server', () => ({
  NextResponse: {
    json: (data: any, init?: any) => ({
      json: async () => data,
      status: init?.status || 200,
    }),
  },
}));

describe('Session API Route', () => {
  beforeEach(() => {
    sessionManager.clear();
  });

  it('should create a new session with valid parameters', async () => {
    const req = {
      json: async () => ({
        seed: 'test-seed',
        width: 10,
        height: 10,
      }),
    } as Request;

    const response = await POST(req);
    const data = await (response as any).json();

    expect(response.status).toBe(200);
    expect(data.sessionId).toBeDefined();
    expect(typeof data.sessionId).toBe('string');

    // Verify session exists in manager
    const session = sessionManager.getSession(data.sessionId);
    expect(session).toBeDefined();
    expect(session?.world).toBeDefined();
    expect(session?.grid).toBeDefined();
    expect(session?.playerId).toBeDefined();
  });

  it('should return 400 for missing seed', async () => {
    const req = {
      json: async () => ({
        width: 10,
        height: 10,
        // missing seed
      }),
    } as Request;

    const response = await POST(req);
    expect(response.status).toBe(400);
  });

  it('GET /api/session resumes exact sessionId and falls back to latest active SIMULATION session', async () => {
    const createReq = {
      json: async () => ({
        seed: 'resume-seed',
        sessionId: 'sim-session-1',
        width: 10,
        height: 10,
      }),
    } as Request;
    await POST(createReq);

    const exactRes = await GET(new Request('http://localhost/api/session?sessionId=sim-session-1'));
    const exactData = await (exactRes as any).json();
    expect(exactData.active).toBe(true);
    expect(exactData.sessionId).toBe('sim-session-1');
    expect(exactData.initialState).toBeDefined();

    // Missing/expired sessionId falls back in non-production to latest active simulation session
    const fallbackRes = await GET(new Request('http://localhost/api/session?sessionId=expired-id'));
    const fallbackData = await (fallbackRes as any).json();
    expect(fallbackData.active).toBe(true);
    expect(fallbackData.sessionId).toBe('sim-session-1');
  });

  it('GET /api/session returns active: false when no resumable sessions exist', async () => {
    const res = await GET(new Request('http://localhost/api/session'));
    const data = await (res as any).json();
    expect(data.active).toBe(false);
  });
});
