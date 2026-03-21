import { describe, it, expect, beforeEach, vi } from 'vitest';
import { POST } from '../route';
import { sessionManager } from '@engine/session/SessionManager';

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

  it('should return 400 for missing parameters', async () => {
    const req = {
      json: async () => ({
        seed: 'test-seed',
        // missing width, height
      }),
    } as Request;

    const response = await POST(req);
    expect(response.status).toBe(400);
  });
});
