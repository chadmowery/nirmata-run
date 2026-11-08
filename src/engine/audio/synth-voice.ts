/**
 * Nirmata Runner — Procedural Web Audio Synth Voice
 * Constructs transient and continuous Web Audio node graphs for procedural
 * sound effects, mechanical UI ramps, and multi-layer ambiance drones.
 */

import { SynthPatchConfig, SpatialAudioResult } from './types';

// Cached noise buffers per AudioContext
const noiseBufferCache = new WeakMap<
  AudioContext,
  {
    white?: AudioBuffer;
    pink?: AudioBuffer;
    brown?: AudioBuffer;
  }
>();

function getNoiseBuffers(ctx: AudioContext) {
  let cache = noiseBufferCache.get(ctx);
  if (!cache) {
    cache = {};
    noiseBufferCache.set(ctx, cache);
  }
  return cache;
}

export function getOrCreateNoiseBuffer(
  ctx: AudioContext,
  type: 'white' | 'pink' | 'brown',
  durationSec = 2.0,
): AudioBuffer {
  const cache = getNoiseBuffers(ctx);
  if (cache[type]) {
    return cache[type]!;
  }

  const sampleRate = ctx.sampleRate || 44100;
  const length = Math.floor(sampleRate * durationSec);
  const buffer = ctx.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);

  if (type === 'white') {
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
  } else if (type === 'pink') {
    // Paul Kellet's filtered pink noise algorithm
    let b0 = 0,
      b1 = 0,
      b2 = 0,
      b3 = 0,
      b4 = 0,
      b5 = 0,
      b6 = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.969 * b2 + white * 0.153852;
      b3 = 0.8665 * b3 + white * 0.3104856;
      b4 = 0.55 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.016898;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
      b6 = white * 0.115926;
    }
  } else if (type === 'brown') {
    let lastOut = 0.0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      data[i] = (lastOut + 0.02 * white) / 1.02;
      lastOut = data[i];
      data[i] *= 3.5; // Gain compensation
    }
  }

  cache[type] = buffer;
  return buffer;
}

export function makeDistortionCurve(amount = 0.5): Float32Array<ArrayBuffer> {
  const k = Math.max(1, amount * 50);
  const samples = 4096;
  const buffer = new ArrayBuffer(samples * Float32Array.BYTES_PER_ELEMENT);
  const curve = new Float32Array(buffer);
  const deg = Math.PI / 180;
  for (let i = 0; i < samples; ++i) {
    const x = (i * 2) / samples - 1;
    curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
  }
  return curve;
}

export interface SynthVoiceOptions {
  volumeMultiplier?: number;
  pitchMultiplier?: number;
  spatial?: SpatialAudioResult;
  loop?: boolean;
}

export interface ActiveVoice {
  stop(fadeDurationSec?: number): void;
  gainNode: GainNode;
  pannerNode?: StereoPannerNode;
  occlusionFilter?: BiquadFilterNode;
  updateSpatial?(spatial: SpatialAudioResult, volumeMultiplier?: number): void;
}

/**
 * Triggers a synth voice in the provided AudioContext and connects it to destinationNode.
 */
export function playSynthVoice(
  ctx: AudioContext,
  destinationNode: AudioNode,
  patch: SynthPatchConfig,
  options: SynthVoiceOptions = {},
): ActiveVoice {
  const now = ctx.currentTime;
  const {
    volumeMultiplier = 1.0,
    pitchMultiplier = 1.0,
    spatial,
    loop = false,
  } = options;

  const nodesToClean: AudioNode[] = [];

  // 1. Output Chain: Master Voice Gain -> [Spatial Pan / Occlusion] -> Destination
  const voiceGain = ctx.createGain();
  nodesToClean.push(voiceGain);

  let currentTail: AudioNode = voiceGain;

  // Spatial Panning
  let pannerNode: StereoPannerNode | undefined;
  if (spatial && typeof ctx.createStereoPanner === 'function') {
    const panner = ctx.createStereoPanner();
    panner.pan.setValueAtTime(spatial.pan, now);
    currentTail.connect(panner);
    currentTail = panner;
    nodesToClean.push(panner);
    pannerNode = panner;
  }

  // Spatial Occlusion Filter (Muffled 900Hz lowpass when tile is unrevealed/behind wall)
  let occlusionFilterNode: BiquadFilterNode | undefined;
  if (spatial) {
    const occlusionFilter = ctx.createBiquadFilter();
    occlusionFilter.type = 'lowpass';
    const cutoff = spatial.lowPassCutoff ?? 20000;
    occlusionFilter.frequency.setValueAtTime(cutoff, now);
    currentTail.connect(occlusionFilter);
    currentTail = occlusionFilter;
    nodesToClean.push(occlusionFilter);
    occlusionFilterNode = occlusionFilter;
  }

  currentTail.connect(destinationNode);

  // 2. Waveshaper / Distortion if requested
  let preDistortionTail: AudioNode = voiceGain;
  if (patch.distortion && patch.distortion > 0) {
    const shaper = ctx.createWaveShaper();
    shaper.curve = makeDistortionCurve(patch.distortion);
    shaper.oversample = '2x';
    shaper.connect(voiceGain);
    preDistortionTail = shaper;
    nodesToClean.push(shaper);
  }

  // 3. Optional Biquad Filter
  let preFilterTail: AudioNode = preDistortionTail;
  let filterNode: BiquadFilterNode | null = null;
  if (patch.filterType) {
    filterNode = ctx.createBiquadFilter();
    filterNode.type = patch.filterType;
    const startCutoff = patch.filterCutoffStart ?? 2000;
    filterNode.frequency.setValueAtTime(startCutoff, now);
    if (patch.filterCutoffEnd !== undefined && patch.filterCutoffEnd !== startCutoff) {
      const sweepDuration = Math.max(0.01, patch.attack + patch.decay + patch.hold);
      filterNode.frequency.exponentialRampToValueAtTime(
        Math.max(20, patch.filterCutoffEnd),
        now + sweepDuration,
      );
    }
    if (patch.filterQ !== undefined) {
      filterNode.Q.setValueAtTime(patch.filterQ, now);
    }
    filterNode.connect(preDistortionTail);
    preFilterTail = filterNode;
    nodesToClean.push(filterNode);
  }

  // 4. LFO modulation for filter cutoff (e.g. ambient drones)
  if (patch.lfoFreq && patch.lfoFilterDepth && filterNode) {
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.setValueAtTime(patch.lfoFreq, now);
    lfoGain.gain.setValueAtTime(patch.lfoFilterDepth, now);
    lfo.connect(lfoGain);
    lfoGain.connect(filterNode.frequency);
    lfo.start(now);
    nodesToClean.push(lfo, lfoGain);
  }

  // 5. Sound Generators: Primary Oscillator or Noise Buffer
  const isNoise = patch.waveform.startsWith('noise_');
  let primarySource: AudioScheduledSourceNode;

  const baseFreq = patch.freqStart * pitchMultiplier;
  const targetEndFreq = (patch.freqEnd ?? patch.freqStart) * pitchMultiplier;

  if (isNoise) {
    const noiseType = (patch.waveform.split('_')[1] || 'white') as 'white' | 'pink' | 'brown';
    const noiseBuffer = getOrCreateNoiseBuffer(ctx, noiseType, 2.0);
    const bufferSource = ctx.createBufferSource();
    bufferSource.buffer = noiseBuffer;
    bufferSource.loop = loop || patch.hold > 2.0;
    bufferSource.connect(preFilterTail);
    primarySource = bufferSource;
  } else {
    const osc = ctx.createOscillator();
    osc.type = patch.waveform as OscillatorType;
    osc.frequency.setValueAtTime(Math.max(10, baseFreq), now);

    if (patch.freqEnd !== undefined && patch.freqEnd !== patch.freqStart) {
      const sweepDuration = Math.max(0.01, patch.attack + patch.decay);
      if (patch.freqRampType === 'exponential' && targetEndFreq > 0) {
        osc.frequency.exponentialRampToValueAtTime(
          Math.max(10, targetEndFreq),
          now + sweepDuration,
        );
      } else {
        osc.frequency.linearRampToValueAtTime(
          Math.max(10, targetEndFreq),
          now + sweepDuration,
        );
      }
    }

    // Optional FM Modulator
    if (patch.fmFreq && patch.fmDepth) {
      const fmOsc = ctx.createOscillator();
      const fmGain = ctx.createGain();
      fmOsc.frequency.setValueAtTime(patch.fmFreq * pitchMultiplier, now);
      fmGain.gain.setValueAtTime(patch.fmDepth, now);
      fmOsc.connect(fmGain);
      fmGain.connect(osc.frequency);
      fmOsc.start(now);
      nodesToClean.push(fmOsc, fmGain);
    }

    // Optional Sub-Oscillator / Sub-Noise
    if (patch.subWaveform && patch.subMix && patch.subMix > 0) {
      const isSubNoise = patch.subWaveform.startsWith('noise_');
      const subGain = ctx.createGain();
      subGain.gain.setValueAtTime(patch.subMix, now);
      subGain.connect(preFilterTail);

      if (isSubNoise) {
        const noiseType = (patch.subWaveform.split('_')[1] || 'white') as
          | 'white'
          | 'pink'
          | 'brown';
        const noiseBuffer = getOrCreateNoiseBuffer(ctx, noiseType, 2.0);
        const subBufferSource = ctx.createBufferSource();
        subBufferSource.buffer = noiseBuffer;
        subBufferSource.loop = loop || patch.hold > 2.0;
        subBufferSource.connect(subGain);
        subBufferSource.start(now);
        nodesToClean.push(subBufferSource, subGain);
      } else {
        const subOsc = ctx.createOscillator();
        subOsc.type = patch.subWaveform as OscillatorType;
        const subFreq = baseFreq / 2; // Sub-octave
        subOsc.frequency.setValueAtTime(Math.max(10, subFreq), now);
        if (patch.subDetuneCents) {
          subOsc.detune.setValueAtTime(patch.subDetuneCents, now);
        }
        subOsc.connect(subGain);
        subOsc.start(now);
        nodesToClean.push(subOsc, subGain);
      }
    }

    osc.connect(preFilterTail);
    primarySource = osc;
  }
  nodesToClean.push(primarySource);

  // 6. ADSR Envelope
  const { attack, decay, sustain, hold, release } = patch;
  const peakVolume = Math.max(0, Math.min(1.0, (spatial ? spatial.gain : 1.0) * volumeMultiplier));
  const sustainVolume = peakVolume * Math.max(0, Math.min(1.0, sustain));

  const t0 = now;
  const t1 = t0 + Math.max(0.002, attack);
  const t2 = t1 + Math.max(0.002, decay);
  const t3 = t2 + Math.max(0.002, hold);
  const t4 = t3 + Math.max(0.005, release);

  voiceGain.gain.setValueAtTime(0.0001, t0);
  voiceGain.gain.linearRampToValueAtTime(Math.max(0.0001, peakVolume), t1);
  voiceGain.gain.linearRampToValueAtTime(Math.max(0.0001, sustainVolume), t2);

  if (!loop) {
    voiceGain.gain.setValueAtTime(Math.max(0.0001, sustainVolume), t3);
    voiceGain.gain.linearRampToValueAtTime(0.0001, t4);
  }

  // 7. Lifecycle management
  primarySource.start(t0);

  let isStopped = false;
  const cleanup = () => {
    if (isStopped) return;
    isStopped = true;
    for (const node of nodesToClean) {
      try {
        node.disconnect();
      } catch {
        // Safe to ignore if already disconnected
      }
    }
  };

  if (!loop) {
    primarySource.stop(t4 + 0.05);
    primarySource.onended = cleanup;
  }

  const stopVoice = (fadeDurationSec = 0.05) => {
    if (isStopped) return;
    const stopTime = ctx.currentTime;
    try {
      voiceGain.gain.cancelScheduledValues(stopTime);
      voiceGain.gain.setValueAtTime(voiceGain.gain.value, stopTime);
      voiceGain.gain.linearRampToValueAtTime(0.0001, stopTime + fadeDurationSec);
      primarySource.stop(stopTime + fadeDurationSec + 0.01);
      setTimeout(cleanup, (fadeDurationSec + 0.05) * 1000);
    } catch {
      cleanup();
    }
  };

  const updateSpatial = (newSpatial: SpatialAudioResult, newVolumeMultiplier = 1.0) => {
    if (isStopped) return;
    const updateTime = ctx.currentTime;
    if (pannerNode) {
      pannerNode.pan.setValueAtTime(newSpatial.pan, updateTime);
    }
    if (occlusionFilterNode) {
      const cutoff = newSpatial.lowPassCutoff ?? 20000;
      occlusionFilterNode.frequency.setValueAtTime(cutoff, updateTime);
    }
    const currentPeak = Math.max(0, Math.min(1.0, newSpatial.gain * newVolumeMultiplier));
    const currentSustain = currentPeak * Math.max(0, Math.min(1.0, patch.sustain));
    voiceGain.gain.setValueAtTime(loop ? currentSustain : currentPeak, updateTime);
  };

  return {
    stop: stopVoice,
    gainNode: voiceGain,
    pannerNode,
    occlusionFilter: occlusionFilterNode,
    updateSpatial,
  };
}

export interface HoldRampVoice {
  updateProgress(progress: number): void;
  stop(fadeSec?: number): void;
}

/**
 * Creates a continuous synth voice whose frequency and filter cutoff track a 0..1 hold progress.
 * Used for the 2-second hold-to-confirm ramp on `.btn-lever`.
 */
export function createHoldRampVoice(
  ctx: AudioContext,
  destinationNode: AudioNode,
  volume = 0.4,
): HoldRampVoice {
  const now = ctx.currentTime;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.001, now);
  gain.gain.linearRampToValueAtTime(volume, now + 0.03);

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(400, now);
  filter.Q.setValueAtTime(2.5, now);

  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(180, now);

  const subOsc = ctx.createOscillator();
  subOsc.type = 'sine';
  subOsc.frequency.setValueAtTime(90, now);

  osc.connect(filter);
  subOsc.connect(filter);
  filter.connect(gain);
  gain.connect(destinationNode);

  osc.start(now);
  subOsc.start(now);

  let isStopped = false;

  const updateProgress = (progress: number) => {
    if (isStopped) return;
    const p = Math.max(0, Math.min(1, progress));
    const t = ctx.currentTime;

    // Freq sweep: 180 Hz -> 720 Hz (octave + fifth rise)
    const targetFreq = 180 + p * 540;
    osc.frequency.setTargetAtTime(targetFreq, t, 0.03);
    subOsc.frequency.setTargetAtTime(targetFreq / 2, t, 0.03);

    // Filter sweep: 400 Hz -> 4800 Hz (brightening)
    const targetCutoff = 400 + Math.pow(p, 1.5) * 4400;
    filter.frequency.setTargetAtTime(targetCutoff, t, 0.03);
  };

  const stop = (fadeSec = 0.05) => {
    if (isStopped) return;
    isStopped = true;
    const t = ctx.currentTime;
    try {
      gain.gain.cancelScheduledValues(t);
      gain.gain.setValueAtTime(gain.gain.value, t);
      gain.gain.linearRampToValueAtTime(0.0001, t + fadeSec);
      osc.stop(t + fadeSec + 0.01);
      subOsc.stop(t + fadeSec + 0.01);
      setTimeout(() => {
        try {
          osc.disconnect();
          subOsc.disconnect();
          filter.disconnect();
          gain.disconnect();
        } catch {
          // ignore
        }
      }, (fadeSec + 0.05) * 1000);
    } catch {
      // ignore
    }
  };

  return {
    updateProgress,
    stop,
  };
}
