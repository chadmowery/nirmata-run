import { describe, it, expect } from 'vitest';
import { getVisibleTileRange } from '../../src/rendering/camera';
import { TILE_SIZE, VIEWPORT_W, VIEWPORT_H } from '../../src/rendering/constants';

describe('Viewport Culling', () => {
  it('returns correct range at origin (0,0) with padding', () => {
    const range = getVisibleTileRange(0, 0);
    // startX = floor(0) - 1 = -1
    // endX = -1 + ceil(960/32) + 2 = -1 + 30 + 2 = 31
    expect(range.startX).toBe(-1);
    expect(range.startY).toBe(-1);
    expect(range.endX).toBe(31);
    expect(range.endY).toBe(21);
  });

  it('shifts range correctly when camera moves', () => {
    // Scroll right by 2 tiles (64px)
    // cameraX = -64
    const range = getVisibleTileRange(-64, -64);
    // startX = floor(64/32) - 1 = 2 - 1 = 1
    // endX = 1 + 30 + 2 = 33
    expect(range.startX).toBe(1);
    expect(range.startY).toBe(1);
    expect(range.endX).toBe(33);
    expect(range.endY).toBe(23);
  });

  it('handles partial tile offsets', () => {
    // cameraX = -10 (scrolled 10px right)
    const range = getVisibleTileRange(-10, -10);
    // startX = floor(10/32) - 1 = 0 - 1 = -1
    // endX = -1 + 30 + 2 = 31
    expect(range.startX).toBe(-1);
    expect(range.startY).toBe(-1);
    expect(range.endX).toBe(31);
    expect(range.endY).toBe(21);
  });

  it('handles large negative camera positions (offset right/down)', () => {
    const range = getVisibleTileRange(-1000, -1000);
    // startX = floor(1000/32) - 1 = 31 - 1 = 30
    // endX = 30 + 30 + 2 = 62
    expect(range.startX).toBe(30);
    expect(range.startY).toBe(30);
    expect(range.endX).toBe(62);
    expect(range.endY).toBe(52);
  });
});
