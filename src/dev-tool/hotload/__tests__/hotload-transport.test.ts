import { describe, it, expect, vi, beforeEach } from 'vitest';
import { hotloadBus } from '@/server/dev/hotload-bus';
import { GET as getStream } from '@/app/api/dev/hotload/stream/route';

describe('Hotload Transport & Bus (HOTLOAD-01)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('publishes and delivers commit envelopes to subscribers', () => {
    const received: unknown[] = [];
    const unsub = hotloadBus.subscribe((env) => received.push(env));

    const published = hotloadBus.publishCommit('config:lighting', 'default', { test: 123 });
    expect(published.mode).toBe('COMMIT');
    expect(published.domain).toBe('config:lighting');
    expect(published.targetId).toBe('default');
    expect(received).toHaveLength(1);
    expect(received[0]).toEqual(published);

    unsub();
    hotloadBus.publishCommit('config:lighting', 'default', { test: 456 });
    expect(received).toHaveLength(1);
  });

  it('SSE stream emits connected event and forwards published hotload envelopes', async () => {
    const abortController = new AbortController();
    const req = new Request('http://localhost/api/dev/hotload/stream', {
      signal: abortController.signal,
    });

    const res = await getStream(req);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('text/event-stream');

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();

    const firstChunk = await reader.read();
    const firstText = decoder.decode(firstChunk.value);
    expect(firstText).toContain('event: connected');

    hotloadBus.publishCommit('audioCue', 'sfx_test', { id: 'sfx_test' });
    const secondChunk = await reader.read();
    const secondText = decoder.decode(secondChunk.value);
    expect(secondText).toContain('event: hotload');
    expect(secondText).toContain('sfx_test');

    abortController.abort();
    await reader.cancel();
  });

  it('rejects SSE stream in production mode via checkNonProductionOnly', async () => {
    const prev = process.env.NODE_ENV;
    (process.env as Record<string, string>).NODE_ENV = 'production';
    try {
      const req = new Request('http://localhost/api/dev/hotload/stream');
      const res = await getStream(req);
      expect(res.status).toBe(403);
    } finally {
      (process.env as Record<string, string>).NODE_ENV = prev;
    }
  });
});
