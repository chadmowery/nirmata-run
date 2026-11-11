/**
 * In-memory sliding-window rate limiter for issue reporting.
 * Enforces independent caps for crash reports vs manual reports to prevent mutual starvation.
 */

import { getReportsServerConfig } from './config';

export type ReportRateCategory = 'crash' | 'manual';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export class ReportsRateLimiter {
  private crashTimestamps: number[] = [];
  private manualTimestamps: number[] = [];
  private readonly windowMs = 60 * 60 * 1000; // 1 hour sliding window

  constructor(
    private readonly getCaps: () => { crashCap: number; manualCap: number } = () => {
      const cfg = getReportsServerConfig();
      return { crashCap: cfg.crashCapPerHour, manualCap: cfg.manualCapPerHour };
    }
  ) {}

  /**
   * Checks and consumes one slot in the sliding window for the specified category.
   */
  consume(category: ReportRateCategory, now = Date.now()): RateLimitResult {
    const { crashCap, manualCap } = this.getCaps();
    const cap = category === 'crash' ? crashCap : manualCap;
    const list = category === 'crash' ? this.crashTimestamps : this.manualTimestamps;

    // Prune entries outside the 1-hour sliding window
    const cutoff = now - this.windowMs;
    while (list.length > 0 && list[0] <= cutoff) {
      list.shift();
    }

    if (list.length >= cap) {
      const earliest = list[0];
      const resetTime = earliest + this.windowMs;
      const retryAfter = Math.max(1, Math.ceil((resetTime - now) / 1000));
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds: retryAfter,
      };
    }

    list.push(now);
    return {
      allowed: true,
      remaining: Math.max(0, cap - list.length),
      retryAfterSeconds: 0,
    };
  }

  /**
   * Resets all in-memory rate tracking.
   */
  reset(): void {
    this.crashTimestamps = [];
    this.manualTimestamps = [];
  }
}

// Global process-wide singleton
const globalKey = Symbol.for('nirmata.reportsRateLimiter');
const globalObj = globalThis as unknown as { [key: symbol]: ReportsRateLimiter };

export const reportsRateLimiter: ReportsRateLimiter =
  globalObj[globalKey] || (globalObj[globalKey] = new ReportsRateLimiter());
