import { describe, it, expect, vi, beforeEach } from 'vitest';
import { hotloadBus } from '@/server/dev/hotload-bus';
import { GET as getStream } from '@/app/api/dev/hotload/stream/route';
import { postHotloadCommit } from '../studio-sync';
import { ClientHotloadBridge } from '../client-hotload-bridge';
import { useHotloadToastStore } from '../toast-store';

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

  it('unifies BroadcastChannel and SSE commit envelope IDs with sessionPatches and deduplicates delivery (HIGH-05)', async () => {
    const postedMessages: unknown[] = [];
    const origBC = globalThis.BroadcastChannel;
    class MockBC {
      addEventListener() {}
      removeEventListener() {}
      close() {}
      postMessage(msg: unknown) {
        postedMessages.push(msg);
      }
    }
    globalThis.BroadcastChannel = MockBC as unknown as typeof BroadcastChannel;

    try {
      const serverEnvelope = hotloadBus.publishCommit(
        'entity',
        'null-pointer',
        { name: 'null-pointer' },
        {
          'sess-1': {
            updatedEntities: [
              { entityId: 42, componentsSet: {}, componentsRemoved: [] },
            ],
          },
        },
      );

      postHotloadCommit(
        'entity',
        'null-pointer',
        { name: 'null-pointer' },
        serverEnvelope.sessionPatches,
        serverEnvelope.id,
      );

      expect(postedMessages).toHaveLength(1);
      const bcEnvelope = (postedMessages[0] as { type: string; envelope: typeof serverEnvelope }).envelope;
      expect(bcEnvelope.id).toBe(serverEnvelope.id);
      expect(bcEnvelope.sessionPatches).toEqual(serverEnvelope.sessionPatches);

      useHotloadToastStore.setState({ activeToast: null });
      const pushToastSpy = vi.spyOn(useHotloadToastStore.getState(), 'pushToast');
      const bridge = new ClientHotloadBridge({
        getContext: () => null,
        getRenderSystem: () => null,
        getGameAudioSystem: () => null,
      });

      await bridge.handleEnvelope(bcEnvelope);
      await bridge.handleEnvelope(serverEnvelope);
      expect(pushToastSpy).toHaveBeenCalledTimes(1);
      expect(useHotloadToastStore.getState().activeToast?.id).toBe(serverEnvelope.id);
    } finally {
      globalThis.BroadcastChannel = origBC;
    }
  });
});
