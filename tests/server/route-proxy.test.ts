import { describe, it, expect, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { proxy } from '@/proxy';

describe('Route Protection Proxy Unit Tests', () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    (process.env as Record<string, string | undefined>).NODE_ENV = originalEnv;
  });

  it('permits dev and admin routes in development mode', () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = 'development';

    const req = new NextRequest('http://localhost:3000/dev/gamedata');
    const res = proxy(req);

    // In development, Next.js NextResponse.next() allows the request through
    expect(res.status).toBe(200);
  });

  it('rejects /dev/gamedata with 404 in production mode', () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';

    const req = new NextRequest('http://localhost:3000/dev/gamedata');
    const res = proxy(req);

    expect(res.status).toBe(404);
  });

  it('rejects /api/admin/* endpoints with 404 in production mode', () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';

    const req = new NextRequest('http://localhost:3000/api/admin/grant-all');
    const res = proxy(req);

    expect(res.status).toBe(404);
  });

  it('rejects /api/dev/* endpoints with 404 in production mode', () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';

    const req = new NextRequest('http://localhost:3000/api/dev/gamedata/entities');
    const res = proxy(req);

    expect(res.status).toBe(404);
  });

  it('permits gameplay routes in production mode', () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';

    const req = new NextRequest('http://localhost:3000/api/action');
    const res = proxy(req);

    expect(res.status).toBe(200);
  });
});
