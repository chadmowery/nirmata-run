import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AudioEngine } from '@/engine/audio/audio-engine';
import type { SoundCueDef } from '@/engine/audio/types';

function makeMockAudioParam(initial = 0) {
  const param = {
    value: initial,
    setValueAtTime: vi.fn((v: number) => {
      param.value = v;
    }),
    linearRampToValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
    setTargetAtTime: vi.fn((v: number) => {
      param.value = v;
    }),
    cancelScheduledValues: vi.fn(),
  };
  return param;
}

function createMockAudioContext() {
  const createdOscillators: Array<{
    type: string;
    frequency: ReturnType<typeof makeMockAudioParam>;
    detune: ReturnType<typeof makeMockAudioParam>;
    connect: ReturnType<typeof vi.fn>;
    start: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
  }> = [];
  const createdFilters: Array<{
    type: string;
    frequency: ReturnType<typeof makeMockAudioParam>;
    Q: ReturnType<typeof makeMockAudioParam>;
    connect: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
  }> = [];

  const ctx = {
    currentTime: 1.0,
    state: 'running',
    sampleRate: 44100,
    destination: {},
    resume: vi.fn(async () => {}),
    close: vi.fn(async () => {}),
    createGain: vi.fn(() => ({
      gain: makeMockAudioParam(1),
      connect: vi.fn(),
      disconnect: vi.fn(),
    })),
    createDynamicsCompressor: vi.fn(() => ({
      threshold: makeMockAudioParam(-6),
      knee: makeMockAudioParam(12),
      ratio: makeMockAudioParam(12),
      attack: makeMockAudioParam(0.003),
      release: makeMockAudioParam(0.25),
      connect: vi.fn(),
      disconnect: vi.fn(),
    })),
    createBiquadFilter: vi.fn(() => {
      const f = {
        type: 'lowpass',
        frequency: makeMockAudioParam(1000),
        Q: makeMockAudioParam(1),
        connect: vi.fn(),
        disconnect: vi.fn(),
      };
      createdFilters.push(f);
      return f;
    }),
    createOscillator: vi.fn(() => {
      const osc = {
        type: 'sine',
        frequency: makeMockAudioParam(440),
        detune: makeMockAudioParam(0),
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
        disconnect: vi.fn(),
      };
      createdOscillators.push(osc);
      return osc;
    }),
    createWaveShaper: vi.fn(() => ({
      curve: null,
      oversample: '2x',
      connect: vi.fn(),
      disconnect: vi.fn(),
    })),
    createStereoPanner: vi.fn(() => ({
      pan: makeMockAudioParam(0),
      connect: vi.fn(),
      disconnect: vi.fn(),
    })),
    decodeAudioData: vi.fn(async () => ({ duration: 1 } as AudioBuffer)),
  } as unknown as AudioContext;

  return { ctx, createdOscillators, createdFilters };
}

describe('Real-Time Audio Cue & Synth Voice Hotloading (HOTLOAD-05)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('morphs an active ambiance synth voice in place when waveform topology is unchanged', () => {
    const { ctx, createdOscillators, createdFilters } = createMockAudioContext();
    const engine = new AudioEngine({ isClient: true, audioContext: ctx });
    engine.init();

    const baseCue: SoundCueDef = {
      id: 'amb_test_drone',
      bus: 'ambiance',
      mode: 'synth',
      baseVolume: 0.6,
      cooldownMs: 0,
      pitchVariance: 0,
      loop: true,
      synth: {
        waveform: 'triangle',
        freqStart: 55,
        filterType: 'lowpass',
        filterCutoffStart: 500,
        filterQ: 1.5,
        attack: 0.2,
        decay: 0.2,
        sustain: 0.8,
        hold: 1,
        release: 0.5,
      },
    };

    engine.playAmbianceCue(baseCue);
    const initialOscCount = createdOscillators.length;
    const primaryOsc = createdOscillators[initialOscCount - 1];
    // index 0 is ambianceFilter; index 1 is the voice filter
    const voiceFilter = createdFilters[createdFilters.length - 1];

    // Morph frequency and filter cutoff in place
    engine.hotUpdateCue({
      ...baseCue,
      baseVolume: 0.75,
      synth: {
        ...baseCue.synth!,
        freqStart: 110,
        filterCutoffStart: 1200,
        filterQ: 3.2,
      },
    });

    // No new oscillator spawned — morphed in place!
    expect(createdOscillators.length).toBe(initialOscCount);
    expect(primaryOsc.frequency.setTargetAtTime).toHaveBeenCalledWith(110, expect.any(Number), 0.02);
    expect(voiceFilter.frequency.setTargetAtTime).toHaveBeenCalledWith(1200, expect.any(Number), 0.02);
    expect(voiceFilter.Q.setTargetAtTime).toHaveBeenCalledWith(3.2, expect.any(Number), 0.02);

    // Changing waveform triggers micro-crossfade respawn
    engine.hotUpdateCue({
      ...baseCue,
      synth: {
        ...baseCue.synth!,
        waveform: 'sawtooth',
      },
    });
    expect(createdOscillators.length).toBeGreaterThan(initialOscCount);
    engine.destroy();
  });

  it('evictSampleBuffer removes normalized path entries from sampleBufferCache', () => {
    const { ctx } = createMockAudioContext();
    const engine = new AudioEngine({ isClient: true, audioContext: ctx });
    const cache = (engine as unknown as { sampleBufferCache: Map<string, AudioBuffer> })
      .sampleBufferCache;
    cache.set('/assets/audio/test.ogg', {} as AudioBuffer);
    expect(cache.has('/assets/audio/test.ogg')).toBe(true);

    engine.evictSampleBuffer('public/assets/audio/test.ogg');
    expect(cache.has('/assets/audio/test.ogg')).toBe(false);
    engine.destroy();
  });

  it('applies cue.baseVolume in hotUpdateCue, volumeMultiplier in playAmbianceCue on same cueId, and cleans up stopped voices (MED-03)', () => {
    const { ctx } = createMockAudioContext();
    const engine = new AudioEngine({ isClient: true, audioContext: ctx });
    engine.init();

    const ambCue: SoundCueDef = {
      id: 'amb_band_1_corrupted',
      bus: 'ambiance',
      mode: 'synth',
      baseVolume: 0.4,
      cooldownMs: 0,
      pitchVariance: 0,
      loop: true,
      synth: {
        waveform: 'triangle',
        freqStart: 55,
        filterType: 'lowpass',
        filterCutoffStart: 500,
        filterQ: 1.5,
        attack: 0.2,
        decay: 0.2,
        sustain: 1.0,
        hold: 1,
        release: 0.5,
      },
    };

    engine.playAmbianceCue(ambCue, { volumeMultiplier: 0.4 });
    engine.setAmbianceState({ baseVolume: 0.4 });

    const activeVoice = (engine as unknown as {
      activeAmbianceVoice: { gainNode: { gain: { setTargetAtTime: ReturnType<typeof vi.fn> } } };
    }).activeAmbianceVoice;
    const gainSpy = activeVoice.gainNode.gain.setTargetAtTime;
    gainSpy.mockClear();

    // 1. hotUpdateCue must use cue.baseVolume (0.9) rather than stale ambianceState.baseVolume (0.4)
    engine.hotUpdateCue({ ...ambCue, baseVolume: 0.9 });
    expect(gainSpy).toHaveBeenCalledWith(0.9, expect.any(Number), 0.02);

    // 2. playAmbianceCue on same cueId must update gain when volumeMultiplier changes
    gainSpy.mockClear();
    engine.playAmbianceCue(ambCue, { volumeMultiplier: 0.25 });
    expect(gainSpy).toHaveBeenCalledWith(0.25, expect.any(Number), 0.02);

    // 3. Looping spatial cue switched from synth to sample cleans up activeCueVoices & activeVoiceMap
    const spatialCue: SoundCueDef = {
      id: 'amb_prop_hum',
      bus: 'sfx',
      mode: 'synth',
      baseVolume: 0.5,
      cooldownMs: 0,
      pitchVariance: 0,
      loop: true,
      synth: {
        waveform: 'sine',
        freqStart: 120,
        attack: 0.1,
        decay: 0.1,
        sustain: 0.8,
        hold: 1,
        release: 0.2,
      },
    };
    const voiceId = engine.playCue(spatialCue);
    expect(voiceId).toBeDefined();

    const activeCueVoices = (engine as unknown as { activeCueVoices: Map<string, unknown[]> })
      .activeCueVoices;
    const activeVoiceMap = (engine as unknown as { activeVoiceMap: Map<number, unknown> })
      .activeVoiceMap;
    expect(activeCueVoices.get('amb_prop_hum')?.length).toBe(1);
    expect(activeVoiceMap.has(voiceId!)).toBe(true);

    engine.hotUpdateCue({
      ...spatialCue,
      mode: 'sample',
      samplePath: '/assets/audio/hum.ogg',
    });

    expect(activeCueVoices.has('amb_prop_hum')).toBe(false);
    expect(activeVoiceMap.has(voiceId!)).toBe(false);
    engine.destroy();
  });
});
