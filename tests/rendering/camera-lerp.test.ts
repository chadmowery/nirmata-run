import { describe, it, expect } from 'vitest';
import { lerpCamera } from '../../src/rendering/camera';

describe('Camera Lerp', () => {
  it('returns current position unchanged when t=0', () => {
    const current = { x: 100, y: 100 };
    const target = { x: 200, y: 200 };
    const result = lerpCamera(current.x, current.y, target.x, target.y, 0);
    expect(result.x).toBe(100);
    expect(result.y).toBe(100);
  });

  it('converges to target after sufficient time', () => {
    const current = { x: 0, y: 0 };
    const target = { x: 100, y: 100 };
    // After 1000ms, it should be very close to target
    const result = lerpCamera(current.x, current.y, target.x, target.y, 1000);
    expect(result.x).toBeCloseTo(100, 0);
    expect(result.y).toBeCloseTo(100, 0);
  });

  it('rounds to integer pixels to prevent jitter', () => {
    const current = { x: 0, y: 0 };
    const target = { x: 10, y: 10 };
    // Small delta, should result in an integer
    const result = lerpCamera(current.x, current.y, target.x, target.y, 16); // ~1 frame at 60fps
    expect(Number.isInteger(result.x)).toBe(true);
    expect(Number.isInteger(result.y)).toBe(true);
  });

  it('has a fast response (~50ms reach ~50%)', () => {
    const current = { x: 0, y: 0 };
    const target = { x: 100, y: 100 };
    const result = lerpCamera(current.x, current.y, target.x, target.y, 50);
    // factor = 1 - Math.pow(0.001, 50/1000) = 1 - Math.pow(0.001, 0.05) = 1 - 0.707 = 0.293
    // 0 + (100 - 0) * 0.293 = 29.3 -> rounded to 29
    expect(result.x).toBeGreaterThan(20);
    expect(result.x).toBeLessThan(40);
  });
});
