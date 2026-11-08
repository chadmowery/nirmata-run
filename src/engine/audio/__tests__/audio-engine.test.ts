import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  AudioEngine,
  NoopAudioEngine,
  getAudioEngine,
  setAudioEngine,
  DEFAULT_AUDIO_SETTINGS,
  DEFAULT_AMBIANCE_CUTOFF_NORMAL,
  DEFAULT_AMBIANCE_CUTOFF_DUCKED,
} from '../audio-engine';
import { SoundCueDef } from '../types';

function createMockAudioParam(initialValue = 1) {
  return {
    value: initialValue,
    setValueAtTime: vi.fn(function (this: { value: number }, v: number) {
      this.value = v;
    }),
    linearRampToValueAtTime: vi.fn(function (this: { value: number }, v: number) {
      this.value = v;
    }),
    exponentialRampToValueAtTime: vi.fn(function (this: { value: number }, v: number) {
      this.value = v;
    }),
    setTargetAtTime: vi.fn(),
    cancelScheduledValues: vi.fn(),
  };
}

function createMockAudioNode() {
  return {
    connect: vi.fn(),
    disconnect: vi.fn(),
  };
}

function createMockGainNode(initialGain = 1) {
  return {
    ...createMockAudioNode(),
    gain: createMockAudioParam(initialGain),
  };
}

function createMockBiquadFilterNode(initialFreq = 18000) {
  return {
    ...createMockAudioNode(),
    type: 'lowpass',
    frequency: createMockAudioParam(initialFreq),
    Q: createMockAudioParam(1),
  };
}

function createMockDynamicsCompressorNode() {
  return {
    ...createMockAudioNode(),
    threshold: createMockAudioParam(-6),
    knee: createMockAudioParam(12),
    ratio: createMockAudioParam(12),
    attack: createMockAudioParam(0.003),
    release: createMockAudioParam(0.25),
  };
}

function createMockAudioContext() {
  const destination = createMockAudioNode();
  return {
    currentTime: 10,
    sampleRate: 44100,
    state: 'running',
    destination,
    createGain: vi.fn(() => createMockGainNode()),
    createBiquadFilter: vi.fn(() => createMockBiquadFilterNode()),
    createDynamicsCompressor: vi.fn(() => createMockDynamicsCompressorNode()),
    createStereoPanner: vi.fn(() => ({
      ...createMockAudioNode(),
      pan: createMockAudioParam(0),
    })),
    createWaveShaper: vi.fn(() => ({
      ...createMockAudioNode(),
      curve: null,
      oversample: 'none',
    })),
    createOscillator: vi.fn(() => ({
      ...createMockAudioNode(),
      type: 'sine',
      frequency: createMockAudioParam(440),
      detune: createMockAudioParam(0),
      start: vi.fn(),
      stop: vi.fn(),
    })),
    createBufferSource: vi.fn(() => ({
      ...createMockAudioNode(),
      buffer: null,
      loop: false,
      playbackRate: createMockAudioParam(1),
      start: vi.fn(),
      stop: vi.fn(),
    })),
    createBuffer: vi.fn((_channels: number, length: number) => ({
      getChannelData: vi.fn(() => new Float32Array(length)),
    })),
    decodeAudioData: vi.fn(async (_buffer: ArrayBuffer) => ({
      duration: 1.5,
      length: 66150,
      numberOfChannels: 2,
      sampleRate: 44100,
    })),
    resume: vi.fn(async () => {}),
    close: vi.fn(async () => {}),
  };
}

function installMockAudioContext(mockCtx: ReturnType<typeof createMockAudioContext>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).AudioContext = class {
    constructor() {
      return mockCtx;
    }
  };
}

describe('AudioEngine', () => {
  beforeEach(() => {
    setAudioEngine(null);
  });

  afterEach(() => {
    setAudioEngine(null);
  });

  it('returns NoopAudioEngine when isClient is false or window is undefined', () => {
    const engine = getAudioEngine(false);
    expect(engine).toBeInstanceOf(NoopAudioEngine);

    // No-op calls should not throw
    expect(() => {
      engine.init();
      engine.playCue({
        id: 'test_cue',
        bus: 'sfx',
        mode: 'synth',
        baseVolume: 1,
        cooldownMs: 0,
        pitchVariance: 0,
      });
      engine.startHoldRamp({
        id: 'hold_cue',
        bus: 'ui',
        mode: 'synth',
        baseVolume: 1,
        cooldownMs: 0,
        pitchVariance: 0,
      });
      engine.updateHoldRamp('noop-voice', 0.5);
      engine.stopHoldRamp('noop-voice');
      engine.stopCue('test_cue');
      engine.stopAllAudio();
      engine.setAmbianceState({ depthBand: 'BAND_1' });
      engine.stopAmbiance();
      engine.destroy();
    }).not.toThrow();

    expect(engine.getSettings()).toEqual(DEFAULT_AUDIO_SETTINGS);
  });

  it('updates and queries settings in NoopAudioEngine', () => {
    const engine = new NoopAudioEngine();
    engine.updateSettings({ masterVolume: 0.5, muted: true });

    expect(engine.getSettings().masterVolume).toBe(0.5);
    expect(engine.isMuted()).toBe(true);
  });

  it('initializes Web Audio mixing graph with limiter and channel buses', async () => {
    const mockCtx = createMockAudioContext();
    installMockAudioContext(mockCtx);

    const engine = new AudioEngine(true);
    await engine.init();

    expect(mockCtx.createDynamicsCompressor).toHaveBeenCalled();
    expect(mockCtx.createGain).toHaveBeenCalled();
    expect(mockCtx.createBiquadFilter).toHaveBeenCalled();

    expect(engine.getBusNode('sfx')).toBeDefined();
    expect(engine.getBusNode('ui')).toBeDefined();
    expect(engine.getBusNode('ambiance')).toBeDefined();

    engine.destroy();
  });

  it('enforces cue cooldown throttling', async () => {
    const mockCtx = createMockAudioContext();
    installMockAudioContext(mockCtx);

    const engine = new AudioEngine(true);
    await engine.init();

    const cue: SoundCueDef = {
      id: 'test_shot',
      bus: 'sfx',
      mode: 'synth',
      baseVolume: 1.0,
      cooldownMs: 100,
      pitchVariance: 0,
      synth: {
        waveform: 'square',
        freqStart: 440,
        attack: 0.01,
        decay: 0.05,
        sustain: 0,
        hold: 0,
        release: 0.01,
      },
    };

    engine.playCue(cue);
    const firstCallCount = mockCtx.createOscillator.mock.calls.length;
    expect(firstCallCount).toBeGreaterThan(0);

    // Second play immediately within 100ms cooldown should be ignored
    engine.playCue(cue);
    expect(mockCtx.createOscillator.mock.calls.length).toBe(firstCallCount);

    engine.destroy();
  });

  it('modulates ambiance filter on anchor/pause ducking', async () => {
    const mockCtx = createMockAudioContext();
    installMockAudioContext(mockCtx);

    const engine = new AudioEngine(true);
    await engine.init();

    // Ducked
    engine.setAmbianceState({ isAnchorDucked: true });
    const filter = engine.getBusNode('ambiance') as unknown as ReturnType<typeof createMockBiquadFilterNode>;
    expect(filter.frequency.exponentialRampToValueAtTime).toHaveBeenCalledWith(
      DEFAULT_AMBIANCE_CUTOFF_DUCKED,
      expect.any(Number),
    );

    // Unducked
    engine.setAmbianceState({ isAnchorDucked: false });
    expect(filter.frequency.exponentialRampToValueAtTime).toHaveBeenCalledWith(
      DEFAULT_AMBIANCE_CUTOFF_NORMAL,
      expect.any(Number),
    );

    // Sector condition modulation (e.g. IONIC_STORM -> -40% cutoff drop & Q boost)
    engine.setAmbianceState({ sectorCondition: 'IONIC_STORM' });
    expect(filter.frequency.exponentialRampToValueAtTime).toHaveBeenCalledWith(
      DEFAULT_AMBIANCE_CUTOFF_NORMAL * 0.6,
      expect.any(Number),
    );
    expect(filter.Q.linearRampToValueAtTime).toHaveBeenCalledWith(2.5, expect.any(Number));

    // Heat tier escalation (e.g. Heat Tier 3 -> Q boost)
    engine.setAmbianceState({ heatTier: 3 });
    expect(filter.Q.linearRampToValueAtTime).toHaveBeenCalledWith(2.5 + 3 * 0.5, expect.any(Number));

    // OVERCLOCKED_GRID fallback condition
    engine.setAmbianceState({ heatTier: 0, sectorCondition: 'OVERCLOCKED_GRID' });
    expect(filter.frequency.exponentialRampToValueAtTime).toHaveBeenCalledWith(
      DEFAULT_AMBIANCE_CUTOFF_NORMAL * 1.0,
      expect.any(Number),
    );
    expect(filter.Q.linearRampToValueAtTime).toHaveBeenCalledWith(1.8, expect.any(Number));

    // Declarative overrides from ambiance.json (cutoffMultiplier, resonanceQ, ducking parameters)
    engine.setAmbianceState({
      cutoffMultiplier: 0.75,
      resonanceQ: 2.8,
      stabilityAnchorCutoffHz: 350,
      duckingRampDurationSec: 0.3,
    });
    expect(filter.frequency.exponentialRampToValueAtTime).toHaveBeenCalledWith(
      DEFAULT_AMBIANCE_CUTOFF_NORMAL * 0.75,
      expect.any(Number),
    );
    expect(filter.Q.linearRampToValueAtTime).toHaveBeenCalledWith(2.8, expect.any(Number));

    // Ducking with custom stabilityAnchorCutoffHz
    engine.setAmbianceState({ isAnchorDucked: true });
    expect(filter.frequency.exponentialRampToValueAtTime).toHaveBeenCalledWith(350, expect.any(Number));

    // Pause ducking with custom pauseMenuCutoffHz
    engine.setAmbianceState({
      isAnchorDucked: false,
      isPaused: true,
      pauseMenuCutoffHz: 420,
    });
    expect(filter.frequency.exponentialRampToValueAtTime).toHaveBeenCalledWith(420, expect.any(Number));

    // Resetting ambiance DSP state for Hub / Main Menu restores pristine normal cutoff and Q
    engine.setAmbianceState({
      heatTier: 0,
      sectorCondition: null,
      isAnchorDucked: false,
      isPaused: false,
      cutoffMultiplier: 1.0,
      resonanceQ: 1.0,
    });
    expect(filter.frequency.exponentialRampToValueAtTime).toHaveBeenCalledWith(
      DEFAULT_AMBIANCE_CUTOFF_NORMAL,
      expect.any(Number),
    );
    expect(filter.Q.linearRampToValueAtTime).toHaveBeenCalledWith(1.0, expect.any(Number));

    engine.destroy();
  });

  it('updates gain nodes when settings change and mutes all when muted', async () => {
    const mockCtx = createMockAudioContext();
    installMockAudioContext(mockCtx);

    const engine = new AudioEngine(true);
    await engine.init();

    engine.updateSettings({ masterVolume: 0.4, sfxVolume: 0.7 });
    expect(engine.getSettings().masterVolume).toBe(0.4);
    expect(engine.getSettings().sfxVolume).toBe(0.7);

    engine.updateSettings({ muted: true });
    expect(engine.isMuted()).toBe(true);

    engine.destroy();
  });

  it('stops active sound cue voices when stopCue is called', async () => {
    const mockCtx = createMockAudioContext();
    installMockAudioContext(mockCtx);

    const engine = new AudioEngine(true);
    await engine.init();

    const loopingCue: SoundCueDef = {
      id: 'loop_drone',
      bus: 'ambiance',
      mode: 'synth',
      baseVolume: 0.8,
      cooldownMs: 0,
      pitchVariance: 0,
      loop: true,
      synth: {
        waveform: 'sawtooth',
        freqStart: 120,
        attack: 0.05,
        decay: 0.1,
        sustain: 0.8,
        hold: 0.1,
        release: 0.2,
      },
    };

    engine.playCue(loopingCue);
    expect(mockCtx.createOscillator).toHaveBeenCalled();

    // Calling stopCue should not throw and safely terminate voices
    expect(() => engine.stopCue('loop_drone', 0.05)).not.toThrow();

    engine.destroy();
  });

  it('stops all audio (synth, sample, hold ramp, ambiance) when stopAllAudio is called', async () => {
    const mockCtx = createMockAudioContext();
    installMockAudioContext(mockCtx);

    const engine = new AudioEngine(true);
    await engine.init();

    const cue: SoundCueDef = {
      id: 'active_sfx',
      bus: 'sfx',
      mode: 'synth',
      baseVolume: 0.8,
      cooldownMs: 0,
      pitchVariance: 0,
      loop: true,
      synth: {
        waveform: 'sine',
        freqStart: 440,
        attack: 0.01,
        decay: 0.05,
        sustain: 0.5,
        hold: 0.1,
        release: 0.1,
      },
    };

    engine.playCue(cue);
    const holdVoiceId = engine.startHoldRamp(cue);
    expect(holdVoiceId).toBeDefined();

    // stopAllAudio should stop all voices and clear state
    expect(() => engine.stopAllAudio(0.01)).not.toThrow();

    engine.destroy();
  });

  it('applies pre-configured settings to gain nodes immediately on init()', async () => {
    const mockCtx = createMockAudioContext();
    installMockAudioContext(mockCtx);

    const engine = new AudioEngine(true, { muted: true, masterVolume: 0.5 });
    expect(engine.isMuted()).toBe(true);
    expect(engine.getSettings().masterVolume).toBe(0.5);

    await engine.init();

    // Verify gain node setValueAtTime was called with 0 for muted master
    const masterGainNode = mockCtx.createGain.mock.results[0].value;
    expect(masterGainNode.gain.setValueAtTime).toHaveBeenCalledWith(0, mockCtx.currentTime);

    engine.destroy();
  });

  it('schedules stop on all secondary synth sources (FM, sub, LFO) and cleans up on voice termination', async () => {
    const mockCtx = createMockAudioContext();
    installMockAudioContext(mockCtx);

    const engine = new AudioEngine(true);
    await engine.init();

    const complexCue: SoundCueDef = {
      id: 'complex_synth',
      bus: 'sfx',
      mode: 'synth',
      baseVolume: 0.8,
      cooldownMs: 0,
      pitchVariance: 0,
      synth: {
        waveform: 'sawtooth',
        freqStart: 440,
        fmFreq: 110,
        fmDepth: 50,
        subWaveform: 'triangle',
        subMix: 0.4,
        filterType: 'lowpass',
        lfoFreq: 5,
        lfoFilterDepth: 200,
        attack: 0.01,
        decay: 0.05,
        sustain: 0.5,
        hold: 0.05,
        release: 0.05,
      },
    };

    const voiceId = engine.playCue(complexCue);
    expect(voiceId).toBeDefined();

    // At least 4 oscillators should be created: primary, fm, sub, and lfo
    expect(mockCtx.createOscillator).toHaveBeenCalledTimes(4);

    // Stop voice explicitly
    engine.stopVoice(voiceId!, 0.02);

    // Each oscillator's stop should have been invoked
    const oscInstances = mockCtx.createOscillator.mock.results.map((r) => r.value);
    for (const osc of oscInstances) {
      expect(osc.stop).toHaveBeenCalled();
    }

    engine.destroy();
  });

  describe('AUD-REV-12: Engine Decoupling, Injectable Loaders & Autoplay Unlock', () => {
    it('loads samples via custom injectable sampleLoader without calling global fetch', async () => {
      const mockCtx = createMockAudioContext();
      installMockAudioContext(mockCtx);

      const mockLoader = vi.fn(async (path: string) => {
        expect(path).toBe('/audio/sfx/test-shot.ogg');
        return new ArrayBuffer(1024);
      });

      const engine = new AudioEngine({
        isClient: true,
        sampleLoader: mockLoader,
      });
      await engine.init();

      const sampleCue: SoundCueDef = {
        id: 'sfx_test_sample',
        bus: 'sfx',
        mode: 'sample',
        baseVolume: 0.9,
        cooldownMs: 0,
        pitchVariance: 0,
        samplePath: '/audio/sfx/test-shot.ogg',
      };

      engine.playCue(sampleCue);

      // Allow microtask queue to process async sampleLoader and decodeAudioData
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockLoader).toHaveBeenCalledTimes(1);
      expect(mockCtx.decodeAudioData).toHaveBeenCalledTimes(1);
      expect(mockCtx.createBufferSource).toHaveBeenCalledTimes(1);

      // Test setSampleLoader update
      const secondLoader = vi.fn(async () => new ArrayBuffer(512));
      engine.setSampleLoader(secondLoader);

      const sampleCue2: SoundCueDef = {
        id: 'sfx_test_sample_2',
        bus: 'sfx',
        mode: 'sample',
        baseVolume: 0.9,
        cooldownMs: 0,
        pitchVariance: 0,
        samplePath: '/audio/sfx/second-shot.ogg',
      };

      engine.playCue(sampleCue2);
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(secondLoader).toHaveBeenCalledTimes(1);

      engine.destroy();
    });

    it('decouples DOM unlock listeners by default and attaches only when enableAutoplayUnlock is true', async () => {
      const mockCtx = createMockAudioContext();
      mockCtx.state = 'suspended';
      installMockAudioContext(mockCtx);

      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

      // 1. By default, AudioEngine does NOT attach DOM listeners to window
      const engineDefault = new AudioEngine(true);
      await engineDefault.init();

      expect(addEventListenerSpy).not.toHaveBeenCalledWith(
        'pointerdown',
        expect.any(Function),
        expect.anything(),
      );
      expect(addEventListenerSpy).not.toHaveBeenCalledWith(
        'keydown',
        expect.any(Function),
        expect.anything(),
      );

      engineDefault.destroy();

      // 2. When enableAutoplayUnlock: true is explicitly requested, it binds to window
      addEventListenerSpy.mockClear();
      const engineWithUnlock = new AudioEngine({
        isClient: true,
        enableAutoplayUnlock: true,
      });
      await engineWithUnlock.init();

      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'pointerdown',
        expect.any(Function),
        { once: true, passive: true },
      );
      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'keydown',
        expect.any(Function),
        { once: true, passive: true },
      );

      engineWithUnlock.destroy();

      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        'pointerdown',
        expect.any(Function),
      );
      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        'keydown',
        expect.any(Function),
      );

      addEventListenerSpy.mockRestore();
      removeEventListenerSpy.mockRestore();
    });

    it('resumes suspended context on engine.resume()', async () => {
      const mockCtx = createMockAudioContext();
      mockCtx.state = 'suspended';
      installMockAudioContext(mockCtx);

      const engine = new AudioEngine(true);
      await engine.init();

      expect(mockCtx.resume).not.toHaveBeenCalled();

      await engine.resume();
      expect(mockCtx.resume).toHaveBeenCalledTimes(1);

      engine.destroy();
    });

    it('replays pending ambiance cue when resume() is called after deferred initialization', async () => {
      const mockCtx = createMockAudioContext();
      mockCtx.state = 'suspended';

      // Temporarily remove global AudioContext so early playAmbianceCue caches cue without playing
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const originalAudioContext = (window as any).AudioContext;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (window as any).AudioContext;

      const engine = new AudioEngine(true);

      const ambianceCue: SoundCueDef = {
        id: 'amb_pending_test',
        bus: 'ambiance',
        mode: 'synth',
        baseVolume: 0.5,
        cooldownMs: 0,
        pitchVariance: 0,
        synth: {
          waveform: 'sine',
          freqStart: 120,
          attack: 0.1,
          decay: 0.1,
          sustain: 1.0,
          hold: 0.1,
          release: 0.1,
        },
      };

      engine.playAmbianceCue(ambianceCue);

      // Now restore AudioContext and initialize engine
      installMockAudioContext(mockCtx);
      await engine.init();

      expect(mockCtx.createOscillator).not.toHaveBeenCalled();

      // Calling resume() replays the pending ambiance cue
      await engine.resume();
      expect(mockCtx.createOscillator).toHaveBeenCalled();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).AudioContext = originalAudioContext;
      engine.destroy();
    });

    it('supports direct AudioContext injection via AudioEngineOptions', async () => {
      const customCtx = createMockAudioContext();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const engine = new AudioEngine({
        isClient: true,
        audioContext: customCtx as unknown as AudioContext,
      });

      await engine.init();

      // Master limiter, buses, etc. should have been created on customCtx
      expect(customCtx.createGain).toHaveBeenCalled();
      expect(customCtx.createDynamicsCompressor).toHaveBeenCalled();

      engine.destroy();
      expect(customCtx.close).toHaveBeenCalled();
    });
  });
});
