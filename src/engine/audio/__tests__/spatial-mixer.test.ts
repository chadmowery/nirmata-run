import { describe, it, expect } from 'vitest';
import {
  calculateSpatialAudio,
  DEFAULT_MAX_RADIUS,
  DEFAULT_OCCLUSION_FACTOR,
  DEFAULT_OCCLUSION_CUTOFF_HZ,
  MAX_STEREO_PAN,
} from '../spatial-mixer';

describe('SpatialAudioMixer', () => {
  it('returns maximum gain and centered pan when listener and source are at same tile', () => {
    const result = calculateSpatialAudio({
      listenerX: 5,
      listenerY: 5,
      sourceX: 5,
      sourceY: 5,
    });

    expect(result.distance).toBe(0);
    expect(result.gain).toBe(1.0);
    expect(result.pan).toBe(0);
    expect(result.lowPassCutoff).toBeUndefined();
  });

  it('culled completely when distance exceeds maxRadius', () => {
    const result = calculateSpatialAudio({
      listenerX: 0,
      listenerY: 0,
      sourceX: DEFAULT_MAX_RADIUS + 1,
      sourceY: 0,
    });

    expect(result.distance).toBeGreaterThan(DEFAULT_MAX_RADIUS);
    expect(result.gain).toBe(0);
  });

  it('calculates linear falloff correctly', () => {
    const maxRadius = 10;
    const result = calculateSpatialAudio({
      listenerX: 0,
      listenerY: 0,
      sourceX: 5,
      sourceY: 0,
      maxRadius,
      falloff: 'linear',
    });

    expect(result.distance).toBe(5);
    expect(result.gain).toBeCloseTo(0.5, 4);
  });

  it('calculates inverse falloff correctly', () => {
    const distance = 4;
    const expectedGain = 1 / (1 + 0.35 * distance);
    const result = calculateSpatialAudio({
      listenerX: 0,
      listenerY: 0,
      sourceX: 4,
      sourceY: 0,
      falloff: 'inverse',
    });

    expect(result.gain).toBeCloseTo(expectedGain, 4);
  });

  it('clamps stereo panning to [-0.85, +0.85]', () => {
    // Far to the right
    const right = calculateSpatialAudio({
      listenerX: 0,
      listenerY: 0,
      sourceX: 20,
      sourceY: 0,
      maxRadius: 30,
    });
    expect(right.pan).toBe(MAX_STEREO_PAN);

    // Far to the left
    const left = calculateSpatialAudio({
      listenerX: 20,
      listenerY: 0,
      sourceX: 0,
      sourceY: 0,
      maxRadius: 30,
    });
    expect(left.pan).toBe(-MAX_STEREO_PAN);

    // Center
    const center = calculateSpatialAudio({
      listenerX: 10,
      listenerY: 10,
      sourceX: 10,
      sourceY: 15,
    });
    expect(center.pan).toBe(0);
  });

  it('applies occlusion damping and 900 Hz lowpass when occluded', () => {
    const unoccluded = calculateSpatialAudio({
      listenerX: 0,
      listenerY: 0,
      sourceX: 4,
      sourceY: 0,
      isOccluded: false,
    });

    const occluded = calculateSpatialAudio({
      listenerX: 0,
      listenerY: 0,
      sourceX: 4,
      sourceY: 0,
      isOccluded: true,
    });

    expect(occluded.gain).toBeCloseTo(unoccluded.gain * DEFAULT_OCCLUSION_FACTOR, 4);
    expect(occluded.lowPassCutoff).toBe(DEFAULT_OCCLUSION_CUTOFF_HZ);
  });
});
