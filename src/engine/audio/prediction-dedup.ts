/**
 * Nirmata Runner — Client Prediction Deduplicator
 * Tracks predicted client-origin action tokens and suppresses matching server
 * reconciliation replay events within a configurable sliding TTL window.
 */

export interface PredictionRecord {
  token: string;
  timestamp: number;
}

export const DEFAULT_PREDICTION_TTL_MS = 2000;

export class PredictionDeduplicator {
  private records = new Map<string, PredictionRecord>();
  private readonly ttlMs: number;

  constructor(ttlMs = DEFAULT_PREDICTION_TTL_MS) {
    this.ttlMs = ttlMs;
  }

  private makeKey(eventType: string, token: string): string {
    return `${eventType}::${token}`;
  }

  /**
   * Records a predicted client event token.
   */
  public recordPredicted(eventType: string, token: string, now = Date.now()): void {
    this.pruneExpired(now);
    const key = this.makeKey(eventType, token);
    this.records.set(key, { token, timestamp: now });
  }

  /**
   * Checks if an incoming event matches a previously recorded prediction.
   * If matched and unexpired, consumes the record and returns true (suppress replay).
   * Otherwise returns false (play sound).
   */
  public consumeIfPredicted(eventType: string, token: string, now = Date.now()): boolean {
    this.pruneExpired(now);
    const key = this.makeKey(eventType, token);
    const record = this.records.get(key);

    if (!record) {
      return false;
    }

    if (now - record.timestamp <= this.ttlMs) {
      this.records.delete(key);
      return true;
    }

    this.records.delete(key);
    return false;
  }

  /**
   * Prunes records older than the TTL.
   */
  public pruneExpired(now = Date.now()): void {
    for (const [key, record] of this.records.entries()) {
      if (now - record.timestamp > this.ttlMs) {
        this.records.delete(key);
      }
    }
  }

  /**
   * Clears all recorded predictions.
   */
  public clear(): void {
    this.records.clear();
  }

  /**
   * Returns current active prediction count.
   */
  public get size(): number {
    return this.records.size;
  }
}
