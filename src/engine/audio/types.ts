/**
 * Nirmata Runner — Audio Engine Interfaces & Types
 * Pure, zero-dependency engine definitions for Web Audio sound synthesis,
 * spatial mixing, channel buses, and cue configurations.
 */

export type AudioBusName = 'master' | 'ambiance' | 'sfx' | 'ui';

export type SynthWaveform =
  | 'sine'
  | 'square'
  | 'sawtooth'
  | 'triangle'
  | 'noise_white'
  | 'noise_pink'
  | 'noise_brown';

export interface SynthPatchConfig {
  waveform: SynthWaveform;
  /** Start frequency in Hz (ignored for pure noise unless filter is used) */
  freqStart: number;
  /** End frequency in Hz for pitch sweeps/chirps */
  freqEnd?: number;
  freqRampType?: 'linear' | 'exponential';
  /** Optional secondary sub/detune oscillator */
  subWaveform?: 'sine' | 'square' | 'sawtooth' | 'triangle';
  subDetuneCents?: number;
  subMix?: number; // 0.0 - 1.0
  /** Optional FM modulation */
  fmFreq?: number;
  fmDepth?: number;
  /** Optional BiquadFilter */
  filterType?: 'lowpass' | 'highpass' | 'bandpass' | 'notch';
  filterCutoffStart?: number;
  filterCutoffEnd?: number;
  filterQ?: number;
  /** Optional Distortion / Bitcrush waveshaper amount (0.0 - 1.0) */
  distortion?: number;
  /** ADSR Envelope in seconds */
  attack: number;
  decay: number;
  sustain: number; // Gain level 0.0 - 1.0
  hold: number;
  release: number;
  /** Continuous LFO for looped ambiance synths */
  lfoFreq?: number;
  lfoFilterDepth?: number;
}

export interface SoundCueDef {
  id: string;
  bus: Exclude<AudioBusName, 'master'>;
  mode: 'synth' | 'sample';
  baseVolume: number; // 0.0 - 1.0
  cooldownMs: number; // Minimum ms between triggers of this cue ID (default 30ms)
  pitchVariance: number; // Random +/- pitch variation (e.g. 0.05 = +/- 5%)
  loop?: boolean;
  /** Used when mode === 'synth' */
  synth?: SynthPatchConfig;
  /** Used when mode === 'sample' (e.g. '/assets/audio/sfx/rifle.ogg') */
  samplePath?: string;
}

export interface SpatialCoords {
  listenerX: number;
  listenerY: number;
  sourceX: number;
  sourceY: number;
  maxRadius?: number; // Default 14
  falloff?: 'linear' | 'inverse';
  isOccluded?: boolean;
}

export interface SpatialAudioResult {
  gain: number;
  pan: number;
  distance: number;
  lowPassCutoff?: number;
}

export interface AudioSettings {
  muted: boolean;
  masterVolume: number; // 0.0 - 1.0
  ambianceVolume: number; // 0.0 - 1.0
  sfxVolume: number; // 0.0 - 1.0
  uiVolume: number; // 0.0 - 1.0
}

export interface AmbianceState {
  depthBand: string;
  sectorCondition?: string | null;
  heatTier: number; // 0 - 5
  isAnchorDucked: boolean;
  isPaused: boolean;
  macroTrack?: string;
}

export interface PlayCueOptions {
  volumeMultiplier?: number;
  pitchMultiplier?: number;
  spatial?: SpatialCoords;
}

export interface IAudioEngine {
  init(): Promise<void> | void;
  destroy(): void;
  playCue(cue: SoundCueDef, options?: PlayCueOptions): void;
  startHoldRamp(cue: SoundCueDef): string;
  updateHoldRamp(voiceId: string, progress: number): void;
  stopHoldRamp(voiceId: string): void;
  setAmbianceState(state: Partial<AmbianceState>): void;
  stopAmbiance(): void;
  updateSettings(settings: Partial<AudioSettings>): void;
  getSettings(): AudioSettings;
  isMuted(): boolean;
}
