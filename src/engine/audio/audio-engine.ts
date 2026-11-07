/**
 * Nirmata Runner — Web Audio Engine Singleton & Mixer
 * Manages the Web Audio API graph, channel buses, master anti-clipping limiter,
 * procedural cue triggers, hold ramps, and server/SSR no-op isolation.
 */

import {
  IAudioEngine,
  AudioSettings,
  SoundCueDef,
  PlayCueOptions,
  AmbianceState,
  AudioBusName,
} from './types';
import { calculateSpatialAudio } from './spatial-mixer';
import { playSynthVoice, createHoldRampVoice, HoldRampVoice, ActiveVoice } from './synth-voice';

export const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  muted: false,
  masterVolume: 0.8,
  ambianceVolume: 0.6,
  sfxVolume: 0.85,
  uiVolume: 0.75,
};

export const DEFAULT_AMBIANCE_CUTOFF_NORMAL = 18000;
export const DEFAULT_AMBIANCE_CUTOFF_DUCKED = 380;

/**
 * Headless/Server No-Op Audio Engine for SSR, server API routes, and headless testing.
 */
export class NoopAudioEngine implements IAudioEngine {
  private settings: AudioSettings = { ...DEFAULT_AUDIO_SETTINGS };

  public init(): void {}
  public destroy(): void {}
  public playCue(cue: SoundCueDef, options?: PlayCueOptions): void {
    void cue;
    void options;
  }
  public startHoldRamp(cue: SoundCueDef): string {
    void cue;
    return 'noop-voice';
  }
  public updateHoldRamp(voiceId: string, progress: number): void {
    void voiceId;
    void progress;
  }
  public stopHoldRamp(voiceId: string): void {
    void voiceId;
  }
  public stopCue(cueId: string, fadeDurationSec?: number): void {
    void cueId;
    void fadeDurationSec;
  }
  public stopAllAudio(fadeDurationSec?: number): void {
    void fadeDurationSec;
  }
  public playAmbianceCue(cue: SoundCueDef): void {
    void cue;
  }
  public setAmbianceState(state: Partial<AmbianceState>): void {
    void state;
  }
  public getAmbianceState(): AmbianceState {
    return {
      depthBand: 'MAIN_MENU',
      sectorCondition: null,
      heatTier: 0,
      isAnchorDucked: false,
      isPaused: false,
    };
  }
  public stopAmbiance(): void {}
  public updateSettings(settings: Partial<AudioSettings>): void {
    this.settings = { ...this.settings, ...settings };
  }
  public getSettings(): AudioSettings {
    return { ...this.settings };
  }
  public isMuted(): boolean {
    return this.settings.muted;
  }
}

/**
 * Client-Side Authoritative Audio Engine using Web Audio API.
 */
export class AudioEngine implements IAudioEngine {
  private ctx: AudioContext | null = null;
  private isClient: boolean;

  // Master Limiter & Channel Buses
  private masterGain: GainNode | null = null;
  private masterCompressor: DynamicsCompressorNode | null = null;
  private sfxGain: GainNode | null = null;
  private uiGain: GainNode | null = null;
  private ambianceGain: GainNode | null = null;
  private ambianceFilter: BiquadFilterNode | null = null;

  // State & Caches
  private settings: AudioSettings = { ...DEFAULT_AUDIO_SETTINGS };
  private cueCooldowns = new Map<string, number>();
  private sampleBufferCache = new Map<string, AudioBuffer>();
  private activeHoldVoices = new Map<string, HoldRampVoice>();
  private activeCueVoices = new Map<string, ActiveVoice[]>();
  private allActiveVoices = new Set<ActiveVoice>();
  private activeSampleSources = new Set<AudioBufferSourceNode>();
  private activeCueSamples = new Map<string, AudioBufferSourceNode[]>();
  private nextVoiceId = 1;

  // Continuous Ambiance Management
  private ambianceState: AmbianceState = {
    depthBand: 'MAIN_MENU',
    sectorCondition: null,
    heatTier: 0,
    isAnchorDucked: false,
    isPaused: false,
  };
  private activeAmbianceVoice: ActiveVoice | null = null;
  private activeAmbianceSampleSource: AudioBufferSourceNode | null = null;
  private activeAmbianceSampleGain: GainNode | null = null;
  private lastRequestedAmbianceCue: SoundCueDef | null = null;
  private currentAmbianceCueId: string | null = null;

  // Autoplay Unlock
  private unlockHandler: (() => void) | null = null;

  constructor(isClient = typeof window !== 'undefined') {
    this.isClient = isClient;
  }

  /**
   * Lazily initializes the Web Audio context and mixing graph.
   */
  public async init(): Promise<void> {
    if (!this.isClient || typeof window === 'undefined') return;
    if (this.ctx) return;

    const AudioContextClass =
      window.AudioContext ||
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).webkitAudioContext;

    if (!AudioContextClass) {
      return;
    }

    try {
      this.ctx = new AudioContextClass();
    } catch {
      return;
    }

    this.setupAudioGraph();
    this.setupAutoplayUnlock();
    this.applySettings();
  }

  private setupAudioGraph(): void {
    if (!this.ctx) return;

    // 1. Master Output Gain -> Destination
    this.masterGain = this.ctx.createGain();
    this.masterGain.connect(this.ctx.destination);

    // 2. DynamicsCompressorNode (Master Anti-Clipping Limiter)
    this.masterCompressor = this.ctx.createDynamicsCompressor();
    this.masterCompressor.threshold.setValueAtTime(-6, this.ctx.currentTime);
    this.masterCompressor.knee.setValueAtTime(12, this.ctx.currentTime);
    this.masterCompressor.ratio.setValueAtTime(12, this.ctx.currentTime);
    this.masterCompressor.attack.setValueAtTime(0.003, this.ctx.currentTime);
    this.masterCompressor.release.setValueAtTime(0.25, this.ctx.currentTime);
    this.masterCompressor.connect(this.masterGain);

    // 3. SFX Bus -> Limiter
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.connect(this.masterCompressor);

    // 4. UI Bus -> Limiter
    this.uiGain = this.ctx.createGain();
    this.uiGain.connect(this.masterCompressor);

    // 5. Ambiance Filter -> Ambiance Bus -> Limiter
    this.ambianceGain = this.ctx.createGain();
    this.ambianceFilter = this.ctx.createBiquadFilter();
    this.ambianceFilter.type = 'lowpass';
    this.ambianceFilter.frequency.setValueAtTime(
      DEFAULT_AMBIANCE_CUTOFF_NORMAL,
      this.ctx.currentTime,
    );
    this.ambianceFilter.Q.setValueAtTime(1.0, this.ctx.currentTime);

    this.ambianceFilter.connect(this.ambianceGain);
    this.ambianceGain.connect(this.masterCompressor);
  }

  private setupAutoplayUnlock(): void {
    if (!this.ctx || typeof window === 'undefined') return;

    if (this.ctx.state === 'suspended') {
      const unlock = () => {
        if (this.ctx && this.ctx.state === 'suspended') {
          this.ctx
            .resume()
            .then(() => {
              if (
                this.lastRequestedAmbianceCue &&
                !this.activeAmbianceVoice &&
                !this.activeAmbianceSampleSource
              ) {
                const cue = this.lastRequestedAmbianceCue;
                this.currentAmbianceCueId = null;
                this.playAmbianceCue(cue);
              }
            })
            .catch(() => {});
        }
        if (this.unlockHandler) {
          window.removeEventListener('pointerdown', this.unlockHandler);
          window.removeEventListener('keydown', this.unlockHandler);
          this.unlockHandler = null;
        }
      };

      this.unlockHandler = unlock;
      window.addEventListener('pointerdown', unlock, { once: true, passive: true });
      window.addEventListener('keydown', unlock, { once: true, passive: true });
    }
  }

  /**
   * Returns destination node for a specified bus.
   */
  public getBusNode(bus: Exclude<AudioBusName, 'master'>): AudioNode | null {
    if (!this.ctx) return null;
    switch (bus) {
      case 'ambiance':
        return this.ambianceFilter;
      case 'ui':
        return this.uiGain;
      case 'sfx':
      default:
        return this.sfxGain;
    }
  }

  /**
   * Applies current AudioSettings to gain nodes.
   */
  private applySettings(): void {
    if (!this.ctx || !this.masterGain || !this.ambianceGain || !this.sfxGain || !this.uiGain) {
      return;
    }

    const t = this.ctx.currentTime;
    const isMuted = this.settings.muted;

    this.masterGain.gain.setValueAtTime(isMuted ? 0 : this.settings.masterVolume, t);
    this.ambianceGain.gain.setValueAtTime(isMuted ? 0 : this.settings.ambianceVolume, t);
    this.sfxGain.gain.setValueAtTime(isMuted ? 0 : this.settings.sfxVolume, t);
    this.uiGain.gain.setValueAtTime(isMuted ? 0 : this.settings.uiVolume, t);
  }

  /**
   * Updates audio settings and persists them to node gains.
   */
  public updateSettings(settings: Partial<AudioSettings>): void {
    this.settings = { ...this.settings, ...settings };
    this.applySettings();
  }

  public getSettings(): AudioSettings {
    return { ...this.settings };
  }

  public isMuted(): boolean {
    return this.settings.muted;
  }

  /**
   * Triggers a sound cue with optional spatial positioning and pitch variance.
   */
  public playCue(cue: SoundCueDef, options: PlayCueOptions = {}): void {
    if (this.settings.muted) return;
    if (!this.ctx) {
      this.init();
      if (!this.ctx) return;
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    const now = Date.now();
    const lastTrigger = this.cueCooldowns.get(cue.id) || 0;
    const cooldown = cue.cooldownMs ?? 30;

    if (now - lastTrigger < cooldown) {
      return; // Suppress duplicate within cooldown window
    }
    this.cueCooldowns.set(cue.id, now);

    const busNode = this.getBusNode(cue.bus);
    if (!busNode) return;

    // Pitch variance calculation (random +/- variance)
    let pitchMultiplier = options.pitchMultiplier ?? 1.0;
    if (cue.pitchVariance && cue.pitchVariance > 0) {
      const delta = (Math.random() * 2 - 1) * cue.pitchVariance;
      pitchMultiplier *= 1.0 + delta;
    }

    // Spatial calculations
    const spatialResult = options.spatial ? calculateSpatialAudio(options.spatial) : undefined;
    if (spatialResult && spatialResult.gain <= 0) {
      return; // Inaudible or out of hearing range
    }

    const volumeMultiplier = (options.volumeMultiplier ?? 1.0) * (cue.baseVolume ?? 1.0);

    // Play synthesis voice
    if (cue.mode === 'synth' && cue.synth) {
      const voice = playSynthVoice(this.ctx, busNode, cue.synth, {
        volumeMultiplier,
        pitchMultiplier,
        spatial: spatialResult,
        loop: cue.loop ?? false,
      });

      if (voice) {
        if (!this.activeCueVoices.has(cue.id)) {
          this.activeCueVoices.set(cue.id, []);
        }
        this.activeCueVoices.get(cue.id)!.push(voice);
        this.allActiveVoices.add(voice);

        // Auto-cleanup non-looping voices after release
        if (!cue.loop) {
          const durationSec =
            cue.synth.attack + cue.synth.decay + cue.synth.hold + cue.synth.release + 0.5;
          setTimeout(() => {
            this.allActiveVoices.delete(voice);
            const list = this.activeCueVoices.get(cue.id);
            if (list) {
              const idx = list.indexOf(voice);
              if (idx !== -1) list.splice(idx, 1);
              if (list.length === 0) this.activeCueVoices.delete(cue.id);
            }
          }, durationSec * 1000);
        }
      }
    } else if (cue.mode === 'sample' && cue.samplePath) {
      this.playSampleVoice(cue, busNode, volumeMultiplier, pitchMultiplier, spatialResult);
    }
  }

  /**
   * Stops all active voices currently playing for a given sound cue ID.
   */
  public stopCue(cueId: string, fadeDurationSec = 0.05): void {
    const voices = this.activeCueVoices.get(cueId);
    if (voices && voices.length > 0) {
      for (const v of voices) {
        try {
          v.stop(fadeDurationSec);
        } catch {
          // Safe to ignore
        }
        this.allActiveVoices.delete(v);
      }
      this.activeCueVoices.delete(cueId);
    }

    const samples = this.activeCueSamples.get(cueId);
    if (samples && samples.length > 0) {
      for (const s of samples) {
        try {
          s.stop();
          s.disconnect();
        } catch {
          // Safe to ignore
        }
        this.activeSampleSources.delete(s);
      }
      this.activeCueSamples.delete(cueId);
    }

    if (this.currentAmbianceCueId === cueId) {
      this.stopAmbiance();
    }
  }

  /**
   * Stops all active audio: synth voices, sample sources, hold ramps, and continuous ambiance.
   */
  public stopAllAudio(fadeDurationSec = 0.05): void {
    // 1. Stop all active synth voices
    for (const v of this.allActiveVoices) {
      try {
        v.stop(fadeDurationSec);
      } catch {
        // Safe to ignore
      }
    }
    this.allActiveVoices.clear();
    this.activeCueVoices.clear();

    // 2. Stop all active sample sources
    for (const src of this.activeSampleSources) {
      try {
        src.stop();
        src.disconnect();
      } catch {
        // Safe to ignore
      }
    }
    this.activeSampleSources.clear();
    this.activeCueSamples.clear();

    // 3. Stop continuous ambiance drone
    this.stopAmbiance();

    // 4. Stop all hold ramps
    for (const ramp of this.activeHoldVoices.values()) {
      try {
        ramp.stop(fadeDurationSec);
      } catch {
        // Safe to ignore
      }
    }
    this.activeHoldVoices.clear();
  }

  private async playSampleVoice(
    cue: SoundCueDef,
    busNode: AudioNode,
    volumeMultiplier: number,
    pitchMultiplier: number,
    spatial?: ReturnType<typeof calculateSpatialAudio>,
  ): Promise<void> {
    if (!this.ctx || !cue.samplePath) return;

    let cleanPath = cue.samplePath.trim();
    if (cleanPath.startsWith('public/')) {
      cleanPath = cleanPath.slice('public'.length);
    }
    if (!cleanPath.startsWith('/') && !cleanPath.startsWith('http')) {
      cleanPath = '/' + cleanPath;
    }

    let buffer = this.sampleBufferCache.get(cleanPath);
    if (!buffer) {
      try {
        const response = await fetch(cleanPath);
        if (!response.ok) return;
        const arrayBuffer = await response.arrayBuffer();
        buffer = await this.ctx.decodeAudioData(arrayBuffer);
        this.sampleBufferCache.set(cleanPath, buffer);
      } catch {
        return;
      }
    }

    if (this.ctx.state === 'suspended') {
      try {
        await this.ctx.resume();
      } catch {
        // Safe to ignore
      }
    }

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.setValueAtTime(pitchMultiplier, this.ctx.currentTime);
    source.loop = cue.loop ?? false;

    const gain = this.ctx.createGain();
    const finalVolume = volumeMultiplier * (spatial ? spatial.gain : 1.0);
    gain.gain.setValueAtTime(finalVolume, this.ctx.currentTime);

    let tailNode: AudioNode = gain;
    if (spatial && typeof this.ctx.createStereoPanner === 'function') {
      const panner = this.ctx.createStereoPanner();
      panner.pan.setValueAtTime(spatial.pan, this.ctx.currentTime);
      tailNode.connect(panner);
      tailNode = panner;
    }

    tailNode.connect(busNode);
    source.connect(gain);
    source.start(this.ctx.currentTime);
    this.activeSampleSources.add(source);
    if (!this.activeCueSamples.has(cue.id)) {
      this.activeCueSamples.set(cue.id, []);
    }
    this.activeCueSamples.get(cue.id)!.push(source);

    source.onended = () => {
      this.activeSampleSources.delete(source);
      const list = this.activeCueSamples.get(cue.id);
      if (list) {
        const idx = list.indexOf(source);
        if (idx !== -1) list.splice(idx, 1);
        if (list.length === 0) this.activeCueSamples.delete(cue.id);
      }
    };
  }

  /**
   * Starts a continuous pitch/filter ramp for 2-second hold-to-confirm levers.
   */
  public startHoldRamp(cue: SoundCueDef): string {
    if (this.settings.muted) return 'muted-voice';
    if (!this.ctx) {
      this.init();
      if (!this.ctx) return 'noop-voice';
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    const volume = cue.baseVolume ?? 0.35;
    const destination = this.uiGain || this.masterGain || this.ctx.destination;
    const voice = createHoldRampVoice(this.ctx, destination, volume);
    const id = `hold-voice-${this.nextVoiceId++}`;
    this.activeHoldVoices.set(id, voice);
    return id;
  }

  public updateHoldRamp(voiceId: string, progress: number): void {
    const voice = this.activeHoldVoices.get(voiceId);
    if (voice) {
      voice.updateProgress(progress);
    }
  }

  public stopHoldRamp(voiceId: string): void {
    const voice = this.activeHoldVoices.get(voiceId);
    if (voice) {
      voice.stop(0.04);
      this.activeHoldVoices.delete(voiceId);
    }
  }

  /**
   * Reactive Ambiance modulation (Depth Band, Heat Tier, Stability Anchor & Pause Ducking).
   */
  public setAmbianceState(state: Partial<AmbianceState>): void {
    this.ambianceState = { ...this.ambianceState, ...state };
    if (!this.ctx) {
      this.init();
      if (!this.ctx) return;
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    if (!this.ambianceFilter) return;

    const now = this.ctx.currentTime;
    const shouldDuck = this.ambianceState.isAnchorDucked || this.ambianceState.isPaused;

    // Base cutoff frequency
    let targetCutoff = shouldDuck
      ? DEFAULT_AMBIANCE_CUTOFF_DUCKED
      : DEFAULT_AMBIANCE_CUTOFF_NORMAL;

    // Sector condition filter & resonance modulation
    let targetQ = 1.0;
    if (!shouldDuck && this.ambianceState.sectorCondition) {
      switch (this.ambianceState.sectorCondition) {
        case 'IONIC_STORM':
        case 'DARK_SUBNET':
          targetCutoff = Math.max(300, targetCutoff * 0.6); // -40% lowpass reduction
          targetQ = 2.5;
          break;
        case 'THERMAL_FLARE':
        case 'THERMAL_SURGE':
          targetCutoff = Math.max(300, targetCutoff * 0.85);
          targetQ = 3.2; // Resonant warmth peak
          break;
        case 'CORRUPTED':
          targetCutoff = Math.max(300, targetCutoff * 0.7);
          targetQ = 2.0;
          break;
        default:
          break;
      }
    }

    // Heat tier escalation (Tiers 0–5): increase resonance Q and tighten filter edge
    if (this.ambianceState.heatTier > 0) {
      targetQ += this.ambianceState.heatTier * 0.5;
      if (!shouldDuck) {
        targetCutoff = Math.max(300, targetCutoff * (1 - this.ambianceState.heatTier * 0.05));
      }
    }

    // Smooth exponential ramp for cutoff and linear ramp for resonance Q
    this.ambianceFilter.frequency.cancelScheduledValues(now);
    this.ambianceFilter.frequency.setValueAtTime(this.ambianceFilter.frequency.value, now);
    this.ambianceFilter.frequency.exponentialRampToValueAtTime(
      Math.max(20, targetCutoff),
      now + 0.25,
    );

    this.ambianceFilter.Q.cancelScheduledValues(now);
    this.ambianceFilter.Q.setValueAtTime(this.ambianceFilter.Q.value, now);
    this.ambianceFilter.Q.linearRampToValueAtTime(targetQ, now + 0.25);
  }

  public getAmbianceState(): AmbianceState {
    return { ...this.ambianceState };
  }

  /**
   * Starts or updates continuous ambiance drone with a given sound cue.
   */
  public playAmbianceCue(cue: SoundCueDef): void {
    this.lastRequestedAmbianceCue = cue;

    if (
      this.currentAmbianceCueId === cue.id &&
      (this.activeAmbianceVoice || this.activeAmbianceSampleSource)
    ) {
      return; // Already playing this cue
    }

    if (!this.ctx) {
      this.init();
      if (!this.ctx) return;
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    const busNode = this.ambianceFilter;
    if (!busNode) return;

    // Crossfade: stop existing synth voice over 800ms
    if (this.activeAmbianceVoice) {
      this.activeAmbianceVoice.stop(0.8);
      this.activeAmbianceVoice = null;
    }

    // Crossfade: stop existing sample source over 800ms
    if (this.activeAmbianceSampleSource && this.activeAmbianceSampleGain) {
      try {
        const prevGain = this.activeAmbianceSampleGain;
        const prevSrc = this.activeAmbianceSampleSource;
        const now = this.ctx.currentTime;
        prevGain.gain.setValueAtTime(prevGain.gain.value, now);
        prevGain.gain.linearRampToValueAtTime(0.0001, now + 0.8);
        setTimeout(() => {
          try {
            prevSrc.stop();
            prevSrc.disconnect();
          } catch {
            // Safe to ignore
          }
        }, 850);
      } catch {
        // Safe to ignore
      }
      this.activeAmbianceSampleSource = null;
      this.activeAmbianceSampleGain = null;
    }

    this.currentAmbianceCueId = cue.id;

    if (cue.mode === 'synth' && cue.synth) {
      this.activeAmbianceVoice = playSynthVoice(this.ctx, busNode, cue.synth, {
        volumeMultiplier: cue.baseVolume ?? 0.6,
        loop: true,
      });
    } else if (cue.mode === 'sample' && cue.samplePath) {
      this.playAmbianceSample(cue, busNode, cue.baseVolume ?? 0.6);
    }

    // Immediately apply existing filter cutoff and Q to the newly started voice/sample
    this.setAmbianceState({});
  }

  private async playAmbianceSample(
    cue: SoundCueDef,
    busNode: AudioNode,
    baseVolume: number,
  ): Promise<void> {
    if (!this.ctx || !cue.samplePath) return;

    let cleanPath = cue.samplePath.trim();
    if (cleanPath.startsWith('public/')) {
      cleanPath = cleanPath.slice('public'.length);
    }
    if (!cleanPath.startsWith('/') && !cleanPath.startsWith('http')) {
      cleanPath = '/' + cleanPath;
    }

    let buffer = this.sampleBufferCache.get(cleanPath);
    if (!buffer) {
      try {
        const response = await fetch(cleanPath);
        if (!response.ok) {
          return;
        }
        const arrayBuffer = await response.arrayBuffer();
        buffer = await this.ctx.decodeAudioData(arrayBuffer);
        this.sampleBufferCache.set(cleanPath, buffer);
      } catch {
        return;
      }
    }

    // If another ambiance cue was requested while fetching/decoding, abort
    if (this.currentAmbianceCueId !== cue.id) {
      return;
    }

    if (this.ctx.state === 'suspended') {
      try {
        await this.ctx.resume();
      } catch {
        // Safe to ignore
      }
    }

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    const gain = this.ctx.createGain();
    const t = this.ctx.currentTime;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(baseVolume, t + 0.5);

    source.connect(gain);
    gain.connect(busNode);
    source.start(t);

    this.activeAmbianceSampleSource = source;
    this.activeAmbianceSampleGain = gain;
  }

  public stopAmbiance(fadeDurationSec = 0.5): void {
    if (this.activeAmbianceVoice) {
      this.activeAmbianceVoice.stop(fadeDurationSec);
      this.activeAmbianceVoice = null;
    }
    if (this.activeAmbianceSampleSource && this.activeAmbianceSampleGain && this.ctx) {
      try {
        const src = this.activeAmbianceSampleSource;
        const gain = this.activeAmbianceSampleGain;
        const now = this.ctx.currentTime;
        gain.gain.setValueAtTime(gain.gain.value, now);
        gain.gain.linearRampToValueAtTime(0.0001, now + fadeDurationSec);
        setTimeout(() => {
          try {
            src.stop();
            src.disconnect();
          } catch {
            // Safe to ignore
          }
        }, (fadeDurationSec + 0.05) * 1000);
      } catch {
        // Safe to ignore
      }
      this.activeAmbianceSampleSource = null;
      this.activeAmbianceSampleGain = null;
    }
    this.currentAmbianceCueId = null;
    this.lastRequestedAmbianceCue = null;
  }

  public destroy(): void {
    this.stopAllAudio(0.01);
    this.cueCooldowns.clear();
    this.sampleBufferCache.clear();

    if (this.unlockHandler && typeof window !== 'undefined') {
      window.removeEventListener('pointerdown', this.unlockHandler);
      window.removeEventListener('keydown', this.unlockHandler);
      this.unlockHandler = null;
    }

    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
  }
}

let activeAudioEngine: IAudioEngine | null = null;

/**
 * Accessor for the active AudioEngine singleton.
 * Returns NoopAudioEngine when running on server, SSR, or without AudioContext.
 */
export function getAudioEngine(isClient = typeof window !== 'undefined'): IAudioEngine {
  if (!isClient || typeof window === 'undefined') {
    return new NoopAudioEngine();
  }

  if (!activeAudioEngine) {
    activeAudioEngine = new AudioEngine(true);
  }
  return activeAudioEngine;
}

export function setAudioEngine(engine: IAudioEngine | null): void {
  if (activeAudioEngine && activeAudioEngine !== engine) {
    activeAudioEngine.destroy();
  }
  activeAudioEngine = engine;
}
