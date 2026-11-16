import { checkNonProductionOnly } from '@/server/security/env-gate';
import { hotloadBus } from '@/server/dev/hotload-bus';
import { ensureAssetWatcherStarted } from '@/server/dev/asset-watcher';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const gate = checkNonProductionOnly();
  if (gate) return gate;

  ensureAssetWatcherStarted();

  const encoder = new TextEncoder();
  let cleanup: (() => void) | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;

      const safeEnqueue = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          closed = true;
          cleanup?.();
        }
      };

      safeEnqueue(`event: connected\ndata: ${JSON.stringify({ timestamp: Date.now() })}\n\n`);

      const unsubscribe = hotloadBus.subscribe((envelope) => {
        safeEnqueue(`event: hotload\ndata: ${JSON.stringify(envelope)}\n\n`);
      });

      const keepalive = setInterval(() => {
        safeEnqueue(`: keepalive ${Date.now()}\n\n`);
      }, 15000);

      cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(keepalive);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // Stream already closed
        }
      };

      req.signal.addEventListener('abort', () => {
        cleanup?.();
      });
    },
    cancel() {
      cleanup?.();
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
