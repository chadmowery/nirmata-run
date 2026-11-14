/**
 * Bounded in-memory ring buffers for client diagnostics.
 * Captures recent engine/game logs and player action intents.
 */

import { logger } from '@engine/utils/logger';
import type { ClientLogEntry, ClientActionEntry } from '@shared/reports/schemas';
import { sanitizeLogMessage } from '@shared/reports/sanitize';

export class RingBuffer<T> {
  private buffer: T[] = [];

  constructor(private readonly capacity: number) {}

  push(item: T): void {
    if (this.buffer.length >= this.capacity) {
      this.buffer.shift();
    }
    this.buffer.push(item);
  }

  toArray(): T[] {
    return [...this.buffer];
  }

  clear(): void {
    this.buffer = [];
  }

  size(): number {
    return this.buffer.length;
  }
}

// Bounded ring buffers matching data contracts (§4)
export const logRingBuffer = new RingBuffer<ClientLogEntry>(100);
export const actionRingBuffer = new RingBuffer<ClientActionEntry>(25);

let unsubscribeLogger: (() => void) | null = null;

/**
 * Initializes the logger sink on the client.
 * Automatically buffers console messages with size and length constraints.
 */
export function initLoggerSink(): () => void {
  if (unsubscribeLogger) return unsubscribeLogger;

  unsubscribeLogger = logger.addSink((entry) => {
    // Skip DEBUG logs to avoid sanitizer regex overhead and buffer eviction in hot loops (L-7)
    if (entry.level === 'DEBUG') return;
    logRingBuffer.push({
      t: entry.t,
      level: entry.level,
      cat: entry.category,
      msg: sanitizeLogMessage(entry.message, 500),
    });
  });

  return () => {
    if (unsubscribeLogger) {
      unsubscribeLogger();
      unsubscribeLogger = null;
    }
  };
}
