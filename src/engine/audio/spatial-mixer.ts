/**
 * Nirmata Runner — 2D Grid Spatial Mixer
 * Pure mathematical conversion of listener and emitter grid positions into
 * stereo panning and distance-attenuated gain.
 */

import { SpatialCoords, SpatialAudioResult } from './types';

export const DEFAULT_MAX_RADIUS = 14;
export const DEFAULT_OCCLUSION_FACTOR = 0.45;
export const DEFAULT_OCCLUSION_CUTOFF_HZ = 900;
export const MAX_STEREO_PAN = 0.85;
export const PAN_DIVISOR = 8.0;

/**
 * Calculates stereo panning and distance attenuation for an emitter relative to a listener.
 */
export function calculateSpatialAudio(coords: SpatialCoords): SpatialAudioResult {
  const {
    listenerX,
    listenerY,
    sourceX,
    sourceY,
    maxRadius = DEFAULT_MAX_RADIUS,
    falloff = 'linear',
    isOccluded = false,
  } = coords;

  const dx = sourceX - listenerX;
  const dy = sourceY - listenerY;
  const distance = Math.hypot(dx, dy);

  // Hearing cutoff: completely culled beyond maxRadius
  if (distance > maxRadius) {
    return {
      gain: 0,
      pan: 0,
      distance,
      lowPassCutoff: isOccluded ? DEFAULT_OCCLUSION_CUTOFF_HZ : undefined,
    };
  }

  // Distance attenuation
  let baseGain: number;
  if (falloff === 'inverse') {
    baseGain = 1 / (1 + 0.35 * distance);
  } else {
    // linear falloff
    baseGain = Math.max(0, 1 - distance / maxRadius);
  }

  // Occlusion damping (behind fog of war or occluded by walls)
  let gain = baseGain;
  let lowPassCutoff: number | undefined;

  if (isOccluded) {
    gain *= DEFAULT_OCCLUSION_FACTOR;
    lowPassCutoff = DEFAULT_OCCLUSION_CUTOFF_HZ;
  }

  // Stereo pan clamped to [-MAX_STEREO_PAN, +MAX_STEREO_PAN]
  const rawPan = dx / PAN_DIVISOR;
  const pan = Math.max(-MAX_STEREO_PAN, Math.min(MAX_STEREO_PAN, rawPan));

  return {
    gain: Math.max(0, Math.min(1, gain)),
    pan,
    distance,
    lowPassCutoff,
  };
}
