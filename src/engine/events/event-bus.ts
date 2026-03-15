/**
 * Signature for an event handler function.
 */
type EventHandler<T = unknown> = (event: T) => void;

/**
 * A type-safe, queued event bus.
 * Events are queued when emitted and processed only when flushed.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class EventBus<TEventMap extends Record<string, any>> {
  private handlers: Map<keyof TEventMap, Set<EventHandler>> = new Map();
  private queue: Array<{ type: keyof TEventMap; event: unknown }> = [];
  private isFlushing = false;
  private readonly MAX_FLUSH_DEPTH = 10;

  /**
   * Subscribe a handler to an event type.
   */
  on<K extends keyof TEventMap>(type: K, handler: EventHandler<TEventMap[K]>): void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }
    this.handlers.get(type)!.add(handler as EventHandler);
  }

  /**
   * Unsubscribe a handler from an event type.
   */
  off<K extends keyof TEventMap>(type: K, handler: EventHandler<TEventMap[K]>): void {
    const handlers = this.handlers.get(type);
    if (handlers) {
      handlers.delete(handler as EventHandler);
    }
  }

  /**
   * Queue an event to be processed on the next flush.
   */
  emit<K extends keyof TEventMap>(type: K, event: TEventMap[K]): void {
    this.queue.push({ type, event });
  }

  /**
   * Process all queued events.
   * If handlers emit new events during flush, they are processed in the same cycle.
   * Max depth prevents infinite loops.
   */
  flush(): void {
    if (this.isFlushing) return;
    this.isFlushing = true;

    let depth = 0;
// ... (rest of flush logic)
    while (this.queue.length > 0) {
      if (depth >= this.MAX_FLUSH_DEPTH) {
        this.isFlushing = false;
        throw new Error(`Max flush depth of ${this.MAX_FLUSH_DEPTH} exceeded. Check for circular event chains.`);
      }

      const currentQueue = [...this.queue];
      this.queue = [];

      for (const { type, event } of currentQueue) {
        const handlers = this.handlers.get(type);
        if (handlers) {
          for (const handler of handlers) {
            handler(event);
          }
        }
      }
      depth++;
    }

    this.isFlushing = false;
  }

  /**
   * Clear all handlers and the current queue.
   */
  clear(): void {
    this.handlers.clear();
    this.queue = [];
    this.isFlushing = false;
  }
}
