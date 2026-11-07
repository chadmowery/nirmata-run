'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  SoundCueDef,
  SynthPatchConfig,
  SynthWaveform,
  AudioBusName,
  getAudioEngine,
  calculateSpatialAudio,
} from '@engine/audio';
import { useGamedataStore } from '../store';
import soundCuesRaw from '@/game/audio/sound-cues.json';
import styles from './editors.module.css';

interface Props {
  name: string;
  isNew?: boolean;
  cloneFrom?: string;
  onRefresh?: () => void;
}

const DEPTH_BAND_CUES: Record<string, string> = {
  'MAIN_MENU': 'amb_main_menu',
  'FLOORS 1–5 (SUBNET)': 'amb_band_1_corrupted',
  'FLOORS 6–10 (FOUNDRY)': 'amb_band_2_static',
  'FLOORS 11–15 (CORE)': 'amb_band_3_logic',
};

const DEFAULT_SYNTH_PATCH: SynthPatchConfig = {
  waveform: 'triangle',
  freqStart: 440,
  attack: 0.01,
  decay: 0.1,
  sustain: 0.3,
  hold: 0.05,
  release: 0.1,
};

const DEFAULT_CUE: SoundCueDef = {
  id: '',
  bus: 'sfx',
  mode: 'synth',
  baseVolume: 0.7,
  cooldownMs: 30,
  pitchVariance: 0.05,
  synth: { ...DEFAULT_SYNTH_PATCH },
};

export function AudioCueStudio({ name, isNew, cloneFrom, onRefresh }: Props) {
  const {
    selectItem,
    clearSelection,
    setDirty,
    setActiveEffectiveData,
    setActiveValidationStatus,
  } = useGamedataStore();

  const [cueData, setCueData] = useState<SoundCueDef | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [isPlayingCue, setIsPlayingCue] = useState<boolean>(false);

  // Spatial Preview State
  const [spatialX, setSpatialX] = useState<number>(3);
  const [spatialY, setSpatialY] = useState<number>(2);
  const [isOccluded, setIsOccluded] = useState<boolean>(false);

  // Hold Ramp Test State
  const [activeVoiceId, setActiveVoiceId] = useState<string | null>(null);
  const [holdProgress, setHoldProgress] = useState<number>(0);

  // Ambiance Simulator State
  const [simDepthBand, setSimDepthBand] = useState<string>('FLOORS 1–5 (SUBNET)');
  const [simCondition, setSimCondition] = useState<string>('NORMAL');
  const [simHeatTier, setSimHeatTier] = useState<number>(0);
  const [simAnchorDucked, setSimAnchorDucked] = useState<boolean>(false);
  const [isAmbiancePlaying, setIsAmbiancePlaying] = useState<boolean>(false);
  const [activeAmbianceCueId, setActiveAmbianceCueId] = useState<string>('');

  // Load cue data
  useEffect(() => {
    if (isNew && cloneFrom) {
      fetch(`/api/dev/gamedata/audio-cues/${cloneFrom}`)
        .then((r) => r.json())
        .then((data: SoundCueDef) => {
          setCueData({ ...data, id: '' });
          setDirty(true);
        })
        .catch(() => setErrors(['Failed to load clone source']));
    } else if (!isNew && name) {
      fetch(`/api/dev/gamedata/audio-cues/${name}`)
        .then((r) => r.json())
        .then((data: SoundCueDef) => {
          setCueData(data);
          setDirty(false);
        })
        .catch(() => setErrors(['Failed to load sound cue']));
    } else {
      setCueData({ ...DEFAULT_CUE });
      setDirty(false);
    }
  }, [name, isNew, cloneFrom, setDirty]);

  // Sync to Gamedata Inspector
  useEffect(() => {
    if (cueData) {
      setActiveEffectiveData(cueData);
      const valid = Boolean(cueData.id && cueData.bus && cueData.mode);
      setActiveValidationStatus({ zodValid: valid });
    }
  }, [cueData, setActiveEffectiveData, setActiveValidationStatus]);

  // Spatial calculations preview
  const spatialMetrics = useMemo(() => {
    return calculateSpatialAudio({
      listenerX: 0,
      listenerY: 0,
      sourceX: spatialX,
      sourceY: spatialY,
      isOccluded,
    });
  }, [spatialX, spatialY, isOccluded]);

  const handleFieldChange = <K extends keyof SoundCueDef>(field: K, value: SoundCueDef[K]) => {
    if (!cueData) return;
    setCueData({ ...cueData, [field]: value });
    setDirty(true);
  };

  const handleSynthChange = <K extends keyof SynthPatchConfig>(
    field: K,
    value: SynthPatchConfig[K],
  ) => {
    if (!cueData) return;
    const currentSynth = cueData.synth || { ...DEFAULT_SYNTH_PATCH };
    setCueData({
      ...cueData,
      synth: { ...currentSynth, [field]: value },
    });
    setDirty(true);
  };

  // Unmount cleanup: stop any lingering audio auditions
  useEffect(() => {
    return () => {
      getAudioEngine().stopAllAudio();
    };
  }, []);

  // Play auditioning
  const handlePlay = useCallback(() => {
    if (!cueData) return;
    const engine = getAudioEngine();
    engine.playCue(cueData);
    setIsPlayingCue(true);
    if (!cueData.loop) {
      const dur = cueData.synth
        ? (cueData.synth.attack + cueData.synth.decay + cueData.synth.hold + cueData.synth.release + 0.5) * 1000
        : 800;
      setTimeout(() => {
        setIsPlayingCue(false);
      }, dur);
    }
  }, [cueData]);

  const handleStopCue = useCallback(() => {
    if (!cueData) return;
    getAudioEngine().stopCue(cueData.id);
    setIsPlayingCue(false);
  }, [cueData]);

  const handleStopAll = useCallback(() => {
    getAudioEngine().stopAllAudio();
    setIsPlayingCue(false);
    setIsAmbiancePlaying(false);
    setActiveAmbianceCueId('');
    setActiveVoiceId(null);
    setHoldProgress(0);
  }, []);

  const handlePlaySpatial = useCallback(() => {
    if (!cueData) return;
    const engine = getAudioEngine();
    engine.playCue(cueData, {
      spatial: {
        listenerX: 0,
        listenerY: 0,
        sourceX: spatialX,
        sourceY: spatialY,
        isOccluded,
      },
    });
    setIsPlayingCue(true);
    if (!cueData.loop) {
      const dur = cueData.synth
        ? (cueData.synth.attack + cueData.synth.decay + cueData.synth.hold + cueData.synth.release + 0.5) * 1000
        : 800;
      setTimeout(() => {
        setIsPlayingCue(false);
      }, dur);
    }
  }, [cueData, spatialX, spatialY, isOccluded]);

  // Hold Ramp Auditioning
  const handleStartHold = () => {
    if (!cueData) return;
    const engine = getAudioEngine();
    const vid = engine.startHoldRamp(cueData);
    setActiveVoiceId(vid);
    setHoldProgress(0);
  };

  const handleUpdateHoldProgress = (p: number) => {
    setHoldProgress(p);
    if (activeVoiceId) {
      const engine = getAudioEngine();
      engine.updateHoldRamp(activeVoiceId, p);
    }
  };

  const handleStopHold = () => {
    if (activeVoiceId) {
      const engine = getAudioEngine();
      engine.stopHoldRamp(activeVoiceId);
      setActiveVoiceId(null);
      setHoldProgress(0);
    }
  };

  // Ambiance Simulation & Real-time DSP Modulation
  const handleApplyAmbianceSimulation = useCallback(
    async (overrideState?: {
      depthBand?: string;
      condition?: string;
      heatTier?: number;
      anchorDucked?: boolean;
    }) => {
      const depthBand = overrideState?.depthBand ?? simDepthBand;
      const condition = overrideState?.condition ?? simCondition;
      const heatTier = overrideState?.heatTier ?? simHeatTier;
      const anchorDucked = overrideState?.anchorDucked ?? simAnchorDucked;

      const engine = getAudioEngine();

      // Determine cue to play:
      // If currently editing an ambiance bus cue, audition that cue!
      // Otherwise, pick the catalog cue corresponding to the selected depth band.
      let cueToPlay: SoundCueDef | undefined;
      if (cueData && cueData.bus === 'ambiance') {
        cueToPlay = cueData;
      } else {
        const targetId = DEPTH_BAND_CUES[depthBand] || 'amb_band_1_corrupted';
        cueToPlay = (soundCuesRaw.cues as SoundCueDef[]).find((c) => c.id === targetId);
        if (!cueToPlay) {
          try {
            const res = await fetch(`/api/dev/gamedata/audio-cues/${targetId}`);
            if (res.ok) {
              cueToPlay = await res.json();
            }
          } catch {
            // Safe fallback
          }
        }
      }

      if (cueToPlay) {
        engine.playAmbianceCue(cueToPlay);
        setActiveAmbianceCueId(cueToPlay.id);
        setIsAmbiancePlaying(true);
      }

      engine.setAmbianceState({
        depthBand,
        sectorCondition: condition === 'NORMAL' ? null : condition,
        heatTier,
        isAnchorDucked: anchorDucked,
        isPaused: false,
      });
    },
    [cueData, simDepthBand, simCondition, simHeatTier, simAnchorDucked],
  );

  const handleStopAmbiance = useCallback(() => {
    const engine = getAudioEngine();
    engine.stopAmbiance();
    setIsAmbiancePlaying(false);
    setActiveAmbianceCueId('');
  }, []);

  const handleDepthBandChange = (newBand: string) => {
    setSimDepthBand(newBand);
    if (isAmbiancePlaying) {
      handleApplyAmbianceSimulation({ depthBand: newBand });
    }
  };

  const handleConditionChange = (newCond: string) => {
    setSimCondition(newCond);
    if (isAmbiancePlaying) {
      const engine = getAudioEngine();
      engine.setAmbianceState({
        sectorCondition: newCond === 'NORMAL' ? null : newCond,
      });
    }
  };

  const handleHeatTierChange = (newHeat: number) => {
    setSimHeatTier(newHeat);
    if (isAmbiancePlaying) {
      const engine = getAudioEngine();
      engine.setAmbianceState({
        heatTier: newHeat,
      });
    }
  };

  const handleAnchorDuckedChange = (newDucked: boolean) => {
    setSimAnchorDucked(newDucked);
    if (isAmbiancePlaying) {
      const engine = getAudioEngine();
      engine.setAmbianceState({
        isAnchorDucked: newDucked,
      });
    }
  };

  const ambianceTelemetry = useMemo(() => {
    const shouldDuck = simAnchorDucked;
    let cutoff = shouldDuck ? 380 : 18000;
    let q = 1.0;

    if (!shouldDuck && simCondition !== 'NORMAL') {
      if (simCondition === 'IONIC_STORM' || simCondition === 'DARK_SUBNET') {
        cutoff = Math.round(cutoff * 0.6);
        q = 2.5;
      } else if (simCondition === 'THERMAL_FLARE' || simCondition === 'THERMAL_SURGE') {
        cutoff = Math.round(cutoff * 0.85);
        q = 3.2;
      } else if (simCondition === 'CORRUPTED') {
        cutoff = Math.round(cutoff * 0.7);
        q = 2.0;
      }
    }

    if (simHeatTier > 0) {
      q += simHeatTier * 0.5;
      if (!shouldDuck) {
        cutoff = Math.round(cutoff * (1 - simHeatTier * 0.05));
      }
    }

    return { cutoff, q };
  }, [simAnchorDucked, simCondition, simHeatTier]);

  // Save handler
  const handleSave = useCallback(async () => {
    if (!cueData) return;
    setSaveStatus('saving');
    setErrors([]);

    if (!cueData.id.trim()) {
      setErrors(['Cue ID is required']);
      setSaveStatus('error');
      return;
    }

    if (cueData.mode === 'sample' && !cueData.samplePath?.trim()) {
      setErrors(['Sample URL path is required when synthesis mode is SAMPLE']);
      setSaveStatus('error');
      return;
    }

    const payload: SoundCueDef = {
      ...cueData,
      id: cueData.id.trim(),
      samplePath: cueData.mode === 'sample' ? cueData.samplePath?.trim() : undefined,
      synth: cueData.mode === 'synth' ? cueData.synth || { ...DEFAULT_SYNTH_PATCH } : undefined,
    };

    try {
      const method = isNew ? 'POST' : 'PUT';
      const url = isNew ? '/api/dev/gamedata/audio-cues' : `/api/dev/gamedata/audio-cues/${name}`;
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to save sound cue');
      }

      setSaveStatus('success');
      setDirty(false);
      onRefresh?.();

      if (isNew) {
        selectItem('audioCues', cueData.id);
      }
    } catch (err) {
      setErrors([err instanceof Error ? err.message : 'Save failed']);
      setSaveStatus('error');
    }
  }, [cueData, isNew, name, setDirty, onRefresh, selectItem]);

  // Clone handler
  const handleClone = () => {
    if (!cueData) return;
    selectItem('audioCues', '__new__');
  };

  // Delete handler
  const handleDelete = async () => {
    if (isNew || !name) return;
    if (!window.confirm(`Are you sure you want to delete sound cue '${name}'?`)) return;

    try {
      const res = await fetch(`/api/dev/gamedata/audio-cues/${name}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to delete sound cue');
      }
      onRefresh?.();
      clearSelection();
    } catch (err) {
      setErrors([err instanceof Error ? err.message : 'Delete failed']);
    }
  };

  // Global Cmd+S listener
  useEffect(() => {
    const onSaveEvent = () => handleSave();
    window.addEventListener('gamedata-save', onSaveEvent);
    return () => window.removeEventListener('gamedata-save', onSaveEvent);
  }, [handleSave]);

  if (!cueData) {
    return (
      <div className={styles.editor}>
        <div className={styles.emptyState}>Loading sound cue telemetry...</div>
      </div>
    );
  }

  const synth = cueData.synth || DEFAULT_SYNTH_PATCH;

  return (
    <div className={styles.editor}>
      {/* Header */}
      <div className={styles.editorHeader}>
        <h2 className={styles.editorTitle}>
          {isNew ? 'NEW SOUND CUE' : `AUDIO CUE // ${cueData.id}`}
        </h2>

        <div className={styles.buttonRow}>
          <button
            type="button"
            className={styles.saveButton}
            onClick={isPlayingCue ? handleStopCue : handlePlay}
            style={{
              borderColor: isPlayingCue ? 'var(--c-danger, #ff2a4b)' : 'var(--c-accent, #d8ff00)',
              color: isPlayingCue ? 'var(--c-danger, #ff2a4b)' : 'var(--c-accent, #d8ff00)',
            }}
          >
            {isPlayingCue ? '■ STOP CUE' : '▶ PLAY CUE'}
          </button>

          <button
            type="button"
            className={styles.cloneButton}
            onClick={handleStopAll}
            title="Stop all currently playing voices, loops, and ambiance"
            style={{
              borderColor: 'var(--c-danger, #ff2a4b)',
              color: 'var(--c-danger, #ff2a4b)',
            }}
          >
            ■ STOP ALL
          </button>

          <button
            type="button"
            className={styles.saveButton}
            onClick={handleSave}
            disabled={saveStatus === 'saving'}
          >
            {saveStatus === 'saving' ? 'SAVING...' : 'SAVE (CMD+S)'}
          </button>

          {!isNew && (
            <button type="button" className={styles.cloneButton} onClick={handleClone}>
              CLONE
            </button>
          )}

          {!isNew && (
            <button type="button" className={styles.deleteButton} onClick={handleDelete}>
              DELETE
            </button>
          )}
        </div>
      </div>

      {errors.length > 0 && (
        <div className={styles.errorBox}>
          {errors.map((e, idx) => (
            <div key={idx}>{e}</div>
          ))}
        </div>
      )}

      {/* Basic Cue Properties */}
      <div className={styles.fieldGroup}>
        <div className={styles.fieldGroupHeader}>
          <span className={styles.fieldGroupTitle}>1. CORE SPECIFICATIONS & BUS ROUTING</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
          <div>
            <label className={styles.label}>CUE ID</label>
            <input
              type="text"
              className={styles.input}
              value={cueData.id}
              disabled={!isNew}
              onChange={(e) => handleFieldChange('id', e.target.value)}
              placeholder="sfx_step_metal"
            />
          </div>

          <div>
            <label className={styles.label}>ROUTING BUS</label>
            <select
              className={styles.select}
              value={cueData.bus}
              onChange={(e) => handleFieldChange('bus', e.target.value as Exclude<AudioBusName, 'master'>)}
            >
              <option value="sfx">SFX BUS (Combat & Movement)</option>
              <option value="ui">UI BUS (Tactile Levers & Tabs)</option>
              <option value="ambiance">AMBIANCE BUS (Drones & Background)</option>
            </select>
          </div>

          <div>
            <label className={styles.label}>SYNTHESIS MODE</label>
            <select
              className={styles.select}
              value={cueData.mode}
              onChange={(e) => handleFieldChange('mode', e.target.value as 'synth' | 'sample')}
            >
              <option value="synth">SYNTH (Procedural Web Audio)</option>
              <option value="sample">SAMPLE (Audio Asset File)</option>
            </select>
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '12px',
            marginTop: '12px',
          }}
        >
          <div>
            <label className={styles.label}>
              BASE VOLUME: {Math.round(cueData.baseVolume * 100)}%
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              className={styles.slider}
              value={cueData.baseVolume}
              onChange={(e) => handleFieldChange('baseVolume', parseFloat(e.target.value))}
            />
          </div>

          <div>
            <label className={styles.label}>COOLDOWN (MS)</label>
            <input
              type="number"
              className={styles.input}
              min="0"
              step="10"
              value={cueData.cooldownMs}
              onChange={(e) => handleFieldChange('cooldownMs', parseInt(e.target.value, 10) || 0)}
            />
          </div>

          <div>
            <label className={styles.label}>
              PITCH VARIANCE: ±{Math.round(cueData.pitchVariance * 100)}%
            </label>
            <input
              type="range"
              min="0"
              max="0.5"
              step="0.01"
              className={styles.slider}
              value={cueData.pitchVariance}
              onChange={(e) => handleFieldChange('pitchVariance', parseFloat(e.target.value))}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', marginTop: '16px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={Boolean(cueData.loop)}
                onChange={(e) => handleFieldChange('loop', e.target.checked)}
              />
              <span className={styles.label} style={{ margin: 0 }}>
                LOOPING AMBIANCE
              </span>
            </label>
          </div>
        </div>

        {cueData.mode === 'sample' && (
          <div style={{ marginTop: '12px' }}>
            <label className={styles.label}>SAMPLE URL PATH</label>
            <input
              type="text"
              className={styles.input}
              value={cueData.samplePath || ''}
              onChange={(e) => handleFieldChange('samplePath', e.target.value)}
              placeholder="/assets/audio/sfx/impact.ogg"
            />
          </div>
        )}
      </div>

      {/* Procedural Synthesizer Parameters */}
      {cueData.mode === 'synth' && (
        <div className={styles.fieldGroup}>
          <div className={styles.fieldGroupHeader}>
            <span className={styles.fieldGroupTitle}>2. OSCILLOSCOPE SYNTH PATCH PARAMETERS</span>
          </div>

          {/* Primary Oscillator */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
            <div>
              <label className={styles.label}>WAVEFORM</label>
              <select
                className={styles.select}
                value={synth.waveform}
                onChange={(e) => handleSynthChange('waveform', e.target.value as SynthWaveform)}
              >
                <option value="triangle">TRIANGLE (Mellow/Tactile)</option>
                <option value="sine">SINE (Pure/Smooth)</option>
                <option value="square">SQUARE (Oscilloscope/Chiptune)</option>
                <option value="sawtooth">SAWTOOTH (Buzzy/Aggressive)</option>
                <option value="noise_white">WHITE NOISE (High Hiss)</option>
                <option value="noise_pink">PINK NOISE (Rain/Airlock)</option>
                <option value="noise_brown">BROWN NOISE (Rumble/Sub)</option>
              </select>
            </div>

            <div>
              <label className={styles.label}>START FREQ (HZ): {Math.round(synth.freqStart)}</label>
              <input
                type="number"
                min="20"
                max="8000"
                className={styles.input}
                value={synth.freqStart}
                onChange={(e) => handleSynthChange('freqStart', parseFloat(e.target.value) || 20)}
              />
            </div>

            <div>
              <label className={styles.label}>
                END FREQ (SWEEP): {synth.freqEnd ? Math.round(synth.freqEnd) : 'NONE'}
              </label>
              <input
                type="number"
                min="0"
                max="8000"
                className={styles.input}
                value={synth.freqEnd || ''}
                placeholder="Optional sweep Hz"
                onChange={(e) =>
                  handleSynthChange(
                    'freqEnd',
                    e.target.value ? parseFloat(e.target.value) : undefined,
                  )
                }
              />
            </div>

            <div>
              <label className={styles.label}>RAMP TYPE</label>
              <select
                className={styles.select}
                value={synth.freqRampType || 'exponential'}
                onChange={(e) =>
                  handleSynthChange('freqRampType', e.target.value as 'linear' | 'exponential')
                }
              >
                <option value="exponential">EXPONENTIAL (Perceptual Pitch)</option>
                <option value="linear">LINEAR (Chirp Ramp)</option>
              </select>
            </div>
          </div>

          {/* Sub Oscillator & FM Modulation */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '12px',
              marginTop: '12px',
            }}
          >
            <div>
              <label className={styles.label}>SUB OSCILLATOR WAVE</label>
              <select
                className={styles.select}
                value={synth.subWaveform || ''}
                onChange={(e) =>
                  handleSynthChange(
                    'subWaveform',
                    (e.target.value || undefined) as SynthPatchConfig['subWaveform'],
                  )
                }
              >
                <option value="">NONE (Disabled)</option>
                <option value="triangle">TRIANGLE</option>
                <option value="sine">SINE</option>
                <option value="square">SQUARE</option>
                <option value="sawtooth">SAWTOOTH</option>
                <option value="noise_white">WHITE NOISE</option>
                <option value="noise_pink">PINK NOISE</option>
                <option value="noise_brown">BROWN NOISE</option>
              </select>
            </div>

            <div>
              <label className={styles.label}>SUB DETUNE (CENTS)</label>
              <input
                type="number"
                min="-1200"
                max="1200"
                className={styles.input}
                value={synth.subDetuneCents ?? 0}
                onChange={(e) =>
                  handleSynthChange('subDetuneCents', parseInt(e.target.value, 10) || 0)
                }
              />
            </div>

            <div>
              <label className={styles.label}>SUB MIX: {Math.round((synth.subMix ?? 0) * 100)}%</label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                className={styles.slider}
                value={synth.subMix ?? 0}
                onChange={(e) => handleSynthChange('subMix', parseFloat(e.target.value))}
              />
            </div>

            <div>
              <label className={styles.label}>
                DISTORTION: {Math.round((synth.distortion ?? 0) * 100)}%
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                className={styles.slider}
                value={synth.distortion ?? 0}
                onChange={(e) => handleSynthChange('distortion', parseFloat(e.target.value))}
              />
            </div>
          </div>

          {/* Filter & FM Modulator */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '12px',
              marginTop: '12px',
            }}
          >
            <div>
              <label className={styles.label}>FILTER TYPE</label>
              <select
                className={styles.select}
                value={synth.filterType || ''}
                onChange={(e) =>
                  handleSynthChange(
                    'filterType',
                    (e.target.value || undefined) as SynthPatchConfig['filterType'],
                  )
                }
              >
                <option value="">NONE (Wide Open)</option>
                <option value="lowpass">LOWPASS (Dark / Muffled)</option>
                <option value="highpass">HIGHPASS (Thin / Bright)</option>
                <option value="bandpass">BANDPASS (Resonant Peak)</option>
                <option value="notch">NOTCH (Phaser Hollow)</option>
              </select>
            </div>

            <div>
              <label className={styles.label}>CUTOFF START (HZ)</label>
              <input
                type="number"
                min="20"
                max="20000"
                className={styles.input}
                value={synth.filterCutoffStart ?? 1000}
                onChange={(e) =>
                  handleSynthChange('filterCutoffStart', parseFloat(e.target.value) || 1000)
                }
              />
            </div>

            <div>
              <label className={styles.label}>FILTER Q (RESONANCE)</label>
              <input
                type="number"
                min="0.1"
                max="20"
                step="0.5"
                className={styles.input}
                value={synth.filterQ ?? 1}
                onChange={(e) => handleSynthChange('filterQ', parseFloat(e.target.value) || 1)}
              />
            </div>

            <div>
              <label className={styles.label}>FM DEPTH</label>
              <input
                type="number"
                min="0"
                max="5000"
                className={styles.input}
                value={synth.fmDepth ?? 0}
                onChange={(e) => handleSynthChange('fmDepth', parseFloat(e.target.value) || 0)}
              />
            </div>
          </div>

          {/* ADSR Envelope */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(5, 1fr)',
              gap: '12px',
              marginTop: '12px',
            }}
          >
            <div>
              <label className={styles.label}>ATTACK: {synth.attack.toFixed(3)}s</label>
              <input
                type="number"
                min="0.001"
                max="5"
                step="0.005"
                className={styles.input}
                value={synth.attack}
                onChange={(e) => handleSynthChange('attack', parseFloat(e.target.value) || 0.001)}
              />
            </div>

            <div>
              <label className={styles.label}>DECAY: {synth.decay.toFixed(3)}s</label>
              <input
                type="number"
                min="0.001"
                max="5"
                step="0.005"
                className={styles.input}
                value={synth.decay}
                onChange={(e) => handleSynthChange('decay', parseFloat(e.target.value) || 0.001)}
              />
            </div>

            <div>
              <label className={styles.label}>SUSTAIN: {Math.round(synth.sustain * 100)}%</label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.02"
                className={styles.slider}
                value={synth.sustain}
                onChange={(e) => handleSynthChange('sustain', parseFloat(e.target.value))}
              />
            </div>

            <div>
              <label className={styles.label}>HOLD: {synth.hold.toFixed(3)}s</label>
              <input
                type="number"
                min="0"
                max="10"
                step="0.05"
                className={styles.input}
                value={synth.hold}
                onChange={(e) => handleSynthChange('hold', parseFloat(e.target.value) || 0)}
              />
            </div>

            <div>
              <label className={styles.label}>RELEASE: {synth.release.toFixed(3)}s</label>
              <input
                type="number"
                min="0.001"
                max="5"
                step="0.005"
                className={styles.input}
                value={synth.release}
                onChange={(e) => handleSynthChange('release', parseFloat(e.target.value) || 0.001)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Interactive Testing & Audition Suite */}
      <div className={styles.fieldGroup}>
        <div className={styles.fieldGroupHeader}>
          <span className={styles.fieldGroupTitle}>3. 2D SPATIAL & TACTILE AUDITION SUITE</span>
        </div>

        {/* Spatial Preview */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '16px',
            padding: '8px',
            background: 'rgba(0, 240, 255, 0.03)',
            border: '1px solid var(--c-border, #1c2638)',
          }}
        >
          <div>
            <div style={{ fontWeight: 700, fontSize: '11px', color: 'var(--c-accent-secondary)' }}>
              2D GRID SPATIAL PANNING & DISTANCE ATTENUATION
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '8px' }}>
              <div>
                <label className={styles.label}>OFFSET X (-10..+10): {spatialX}</label>
                <input
                  type="range"
                  min="-10"
                  max="10"
                  step="1"
                  className={styles.slider}
                  value={spatialX}
                  onChange={(e) => setSpatialX(parseInt(e.target.value, 10))}
                />
              </div>

              <div>
                <label className={styles.label}>OFFSET Y (-10..+10): {spatialY}</label>
                <input
                  type="range"
                  min="-10"
                  max="10"
                  step="1"
                  className={styles.slider}
                  value={spatialY}
                  onChange={(e) => setSpatialY(parseInt(e.target.value, 10))}
                />
              </div>
            </div>

            <div style={{ marginTop: '8px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={isOccluded}
                  onChange={(e) => setIsOccluded(e.target.checked)}
                />
                <span className={styles.label} style={{ margin: 0 }}>
                  WALL OCCLUSION (LOWPASS MUFFLE 600Hz)
                </span>
              </label>
            </div>

            <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
              <button
                type="button"
                className={styles.saveButton}
                onClick={handlePlaySpatial}
                style={{
                  borderColor: 'var(--c-accent-secondary, #00f0ff)',
                  color: 'var(--c-accent-secondary, #00f0ff)',
                }}
              >
                ▶ PLAY SPATIAL SFX
              </button>
              {isPlayingCue && (
                <button
                  type="button"
                  className={styles.saveButton}
                  onClick={handleStopCue}
                  style={{
                    borderColor: 'var(--c-danger, #ff2a4b)',
                    color: 'var(--c-danger, #ff2a4b)',
                  }}
                >
                  ■ STOP
                </button>
              )}
            </div>
          </div>

          <div
            style={{
              padding: '8px',
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              lineHeight: '1.6',
              background: '#04070c',
              border: '1px solid #141e2e',
            }}
          >
            <div style={{ color: 'var(--c-text-dim)', marginBottom: '4px' }}>CALCULATED TELEMETRY:</div>
            <div>DISTANCE: <span style={{ color: '#fff' }}>{spatialMetrics.distance.toFixed(2)} tiles</span></div>
            <div>STEREO PAN: <span style={{ color: 'var(--c-accent-secondary)' }}>{(spatialMetrics.pan * 100).toFixed(0)}% ({spatialMetrics.pan < 0 ? 'LEFT' : spatialMetrics.pan > 0 ? 'RIGHT' : 'CENTER'})</span></div>
            <div>ATTENUATED GAIN: <span style={{ color: 'var(--c-accent)' }}>{(spatialMetrics.gain * 100).toFixed(0)}%</span></div>
            {spatialMetrics.lowPassCutoff && (
              <div>OCCLUSION FILTER: <span style={{ color: 'var(--c-danger)' }}>{spatialMetrics.lowPassCutoff} Hz Lowpass</span></div>
            )}
          </div>
        </div>

        {/* Hold to Confirm Ramp Simulator */}
        <div
          style={{
            marginTop: '16px',
            padding: '8px',
            background: 'rgba(216, 255, 0, 0.03)',
            border: '1px solid var(--c-border, #1c2638)',
          }}
        >
          <div style={{ fontWeight: 700, fontSize: '11px', color: 'var(--c-accent)' }}>
            2-SECOND HOLD-TO-CONFIRM PITCH RAMP AUDITION
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '8px' }}>
            <button
              type="button"
              className={styles.saveButton}
              onClick={activeVoiceId ? handleStopHold : handleStartHold}
              style={{
                borderColor: activeVoiceId ? 'var(--c-danger)' : 'var(--c-accent)',
                color: activeVoiceId ? 'var(--c-danger)' : 'var(--c-accent)',
              }}
            >
              {activeVoiceId ? '■ STOP HOLD RAMP' : '▶ START HOLD RAMP'}
            </button>

            <div style={{ flex: 1 }}>
              <label className={styles.label}>
                HOLD PROGRESS: {Math.round(holdProgress * 100)}%
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.02"
                disabled={!activeVoiceId}
                className={styles.slider}
                value={holdProgress}
                onChange={(e) => handleUpdateHoldProgress(parseFloat(e.target.value))}
              />
            </div>
          </div>
        </div>

        {/* Ambiance Environment Simulator */}
        <div
          style={{
            marginTop: '16px',
            padding: '8px',
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid var(--c-border, #1c2638)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontWeight: 700, fontSize: '11px', color: 'var(--c-text-dim)' }}>
              REACTIVE AMBIANCE ENVIRONMENT SIMULATOR
            </div>
            {isAmbiancePlaying && (
              <span style={{ fontSize: '10px', color: 'var(--c-accent, #d8ff00)', fontWeight: 700 }}>
                ● DRONE ACTIVE: {activeAmbianceCueId}
              </span>
            )}
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '8px',
              marginTop: '8px',
            }}
          >
            <div>
              <label className={styles.label}>DEPTH BAND</label>
              <select
                className={styles.select}
                value={simDepthBand}
                onChange={(e) => handleDepthBandChange(e.target.value)}
              >
                <option value="MAIN_MENU">MAIN_MENU</option>
                <option value="FLOORS 1–5 (SUBNET)">FLOORS 1–5 (SUBNET)</option>
                <option value="FLOORS 6–10 (FOUNDRY)">FLOORS 6–10 (FOUNDRY)</option>
                <option value="FLOORS 11–15 (CORE)">FLOORS 11–15 (CORE)</option>
              </select>
            </div>

            <div>
              <label className={styles.label}>SECTOR CONDITION</label>
              <select
                className={styles.select}
                value={simCondition}
                onChange={(e) => handleConditionChange(e.target.value)}
              >
                <option value="NORMAL">NORMAL (None)</option>
                <option value="IONIC_STORM">IONIC_STORM</option>
                <option value="THERMAL_FLARE">THERMAL_FLARE</option>
                <option value="CORRUPTED">CORRUPTED</option>
              </select>
            </div>

            <div>
              <label className={styles.label}>HEAT TIER: {simHeatTier}</label>
              <input
                type="range"
                min="0"
                max="5"
                step="1"
                className={styles.slider}
                value={simHeatTier}
                onChange={(e) => handleHeatTierChange(parseInt(e.target.value, 10))}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', marginTop: '16px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={simAnchorDucked}
                  onChange={(e) => handleAnchorDuckedChange(e.target.checked)}
                />
                <span className={styles.label} style={{ margin: 0 }}>
                  ANCHOR GRAYSCALE DUCKING (380Hz)
                </span>
              </label>
            </div>
          </div>

          <div style={{ marginTop: '8px', display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className={styles.saveButton}
              onClick={() => handleApplyAmbianceSimulation()}
              style={{
                borderColor: isAmbiancePlaying ? 'var(--c-accent, #d8ff00)' : '#ffffff',
                color: isAmbiancePlaying ? 'var(--c-accent, #d8ff00)' : '#ffffff',
              }}
            >
              {isAmbiancePlaying
                ? '▶ UPDATE AMBIANCE BUS MODULATION'
                : '▶ SIMULATE AMBIANCE BUS MODULATION'}
            </button>
            <button
              type="button"
              className={styles.saveButton}
              onClick={handleStopAmbiance}
              style={{
                borderColor: isAmbiancePlaying ? 'var(--c-danger, #ff2a4b)' : 'var(--c-border, #1c2638)',
                color: isAmbiancePlaying ? 'var(--c-danger, #ff2a4b)' : 'var(--c-text-dim, #79889e)',
              }}
            >
              ■ STOP AMBIANCE DRONE
            </button>
          </div>

          {/* Ambiance Telemetry Readout */}
          <div
            style={{
              marginTop: '12px',
              padding: '8px',
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              lineHeight: '1.6',
              background: '#04070c',
              border: '1px solid #141e2e',
            }}
          >
            <div style={{ color: 'var(--c-text-dim)', marginBottom: '4px' }}>
              AMBIANCE BUS DSP TELEMETRY:
            </div>
            <div>
              STATUS:{' '}
              <span
                style={{
                  color: isAmbiancePlaying
                    ? 'var(--c-accent, #d8ff00)'
                    : 'var(--c-text-dim, #79889e)',
                  fontWeight: 700,
                }}
              >
                {isAmbiancePlaying ? '● SIMULATING (ACTIVE)' : '○ STOPPED'}
              </span>
            </div>
            <div>
              SOURCE CUE:{' '}
              <span style={{ color: '#fff' }}>
                {activeAmbianceCueId ||
                  (cueData?.bus === 'ambiance'
                    ? cueData.id
                    : DEPTH_BAND_CUES[simDepthBand] || 'amb_band_1_corrupted')}
              </span>
            </div>
            <div>
              FILTER CUTOFF:{' '}
              <span
                style={{
                  color: simAnchorDucked
                    ? 'var(--c-danger, #ff2a4b)'
                    : simCondition !== 'NORMAL'
                      ? 'var(--c-warning, #ff6600)'
                      : 'var(--c-accent-secondary, #00f0ff)',
                }}
              >
                {ambianceTelemetry.cutoff} Hz {simAnchorDucked ? '(STABILITY ANCHOR DUCKED)' : ''}
              </span>
            </div>
            <div>
              FILTER RESONANCE (Q):{' '}
              <span style={{ color: 'var(--c-accent, #d8ff00)' }}>
                {ambianceTelemetry.q.toFixed(1)} Q
              </span>
            </div>
            {simHeatTier > 0 && (
              <div>
                HEAT MODULATION:{' '}
                <span style={{ color: 'var(--c-warning, #ff6600)' }}>
                  TIER {simHeatTier} (+{(simHeatTier * 0.5).toFixed(1)} Q RESONANCE PEAK)
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
