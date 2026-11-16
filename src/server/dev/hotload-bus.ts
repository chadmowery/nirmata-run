import { EventEmitter } from 'events';
import type { HotloadDomain, HotloadEnvelope, SessionHotloadPatch } from '@shared/hotload-types';

export type HotloadListener = (envelope: HotloadEnvelope) => void;

class HotloadBus {
  private readonly emitter = new EventEmitter();
  private sequence = 0;

  constructor() {
    this.emitter.setMaxListeners(100);
  }

  public subscribe(listener: HotloadListener): () => void {
    this.emitter.on('hotload', listener);
    return () => {
      this.emitter.off('hotload', listener);
    };
  }

  public publish<T>(envelope: HotloadEnvelope<T>): void {
    if (process.env.NODE_ENV === 'production') return;
    this.emitter.emit('hotload', envelope);
  }

  public publishCommit<T>(
    domain: HotloadDomain,
    targetId: string,
    payload: T,
    sessionPatches?: Record<string, SessionHotloadPatch>,
  ): HotloadEnvelope<T> {
    const timestamp = Date.now();
    this.sequence += 1;
    const envelope: HotloadEnvelope<T> = {
      id: `srv-${timestamp}-${this.sequence}`,
      timestamp,
      mode: 'COMMIT',
      domain,
      targetId,
      payload,
      ...(sessionPatches && Object.keys(sessionPatches).length > 0 ? { sessionPatches } : {}),
    };
    this.publish(envelope);
    return envelope;
  }
}

const globalForHotload = globalThis as unknown as { __nirmataHotloadBus?: HotloadBus };

export const hotloadBus: HotloadBus =
  globalForHotload.__nirmataHotloadBus ?? new HotloadBus();

if (process.env.NODE_ENV !== 'production') {
  globalForHotload.__nirmataHotloadBus = hotloadBus;
}
