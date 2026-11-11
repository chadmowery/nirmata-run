import { describe, it, expect } from 'vitest';
import { ReportsRateLimiter } from '../rate-limiter';

describe('ReportsRateLimiter', () => {
  it('enforces crash report limit independently from manual limit', () => {
    const limiter = new ReportsRateLimiter(() => ({ crashCap: 3, manualCap: 2 }));
    const now = 1000000;

    // Crash requests 1..3 succeed
    expect(limiter.consume('crash', now).allowed).toBe(true);
    expect(limiter.consume('crash', now + 100).allowed).toBe(true);
    expect(limiter.consume('crash', now + 200).allowed).toBe(true);

    // 4th crash request is blocked
    const blockedCrash = limiter.consume('crash', now + 300);
    expect(blockedCrash.allowed).toBe(false);
    expect(blockedCrash.retryAfterSeconds).toBeGreaterThan(0);

    // Manual category is NOT blocked by crash exhaustion
    expect(limiter.consume('manual', now + 400).allowed).toBe(true);
    expect(limiter.consume('manual', now + 500).allowed).toBe(true);

    // 3rd manual request is blocked
    expect(limiter.consume('manual', now + 600).allowed).toBe(false);
  });

  it('slides window after 1 hour', () => {
    const limiter = new ReportsRateLimiter(() => ({ crashCap: 1, manualCap: 1 }));
    const start = 1000000;
    const oneHour = 60 * 60 * 1000;

    expect(limiter.consume('crash', start).allowed).toBe(true);
    expect(limiter.consume('crash', start + 1000).allowed).toBe(false);

    // Exactly after 1 hour, slot is released
    expect(limiter.consume('crash', start + oneHour + 1).allowed).toBe(true);
  });
});
