import { describe, it, expect } from 'vitest';
import { computeCameraTarget } from '../../src/rendering/camera';
import { TILE_SIZE, VIEWPORT_W, VIEWPORT_H } from '../../src/rendering/constants';

describe('Camera Positioning', () => {
  it('centers the player when at (15, 10)', () => {
    // 960x640 viewport, 32px tiles
    // x = 960/2 - 15*32 - 16 = 480 - 480 - 16 = -16
    // y = 640/2 - 10*32 - 16 = 320 - 320 - 16 = -16
    const target = computeCameraTarget(15, 10);
    expect(target.x).toBe(-16);
    expect(target.y).toBe(-16);
  });

  it('centers the player when at (0, 0)', () => {
    // x = 960/2 - 0*32 - 16 = 480 - 16 = 464
    // y = 640/2 - 0*32 - 16 = 320 - 16 = 304
    const target = computeCameraTarget(0, 0);
    expect(target.x).toBe(464);
    expect(target.y).toBe(304);
  });

  it('centers the player when at (30, 20)', () => {
    // x = 480 - 30*32 - 16 = 480 - 960 - 16 = -496
    // y = 320 - 20*32 - 16 = 320 - 640 - 16 = -336
    const target = computeCameraTarget(30, 20);
    expect(target.x).toBe(-496);
    expect(target.y).toBe(-336);
  });
});
