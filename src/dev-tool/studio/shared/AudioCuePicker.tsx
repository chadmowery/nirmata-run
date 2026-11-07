'use client';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { SoundCueDef, getAudioEngine } from '@engine/audio';
import soundCuesRaw from '@/game/audio/sound-cues.json';
import styles from '../editors/editors.module.css';

interface Props {
  value?: string;
  onChange: (value: string | undefined) => void;
  fieldKey?: string;
  componentKey?: string;
  pitchMultiplier?: number;
  volumeMultiplier?: number;
  disabled?: boolean;
}

const RECOMMENDED_CUES_MAP: Record<string, string[]> = {
  stepCue: [
    'sfx_step_player',
    'sfx_step_bastion',
    'sfx_step_ghost',
    'sfx_step_enemy',
    'sfx_teleport_shift',
  ],
  attackCue: [
    'sfx_melee_hit',
    'sfx_ranged_hit',
    'sfx_firmware_cast',
    'sfx_volatile_cryo',
    'sfx_volatile_emp',
  ],
  hitCue: [
    'sfx_player_damaged',
    'sfx_cover_mitigated',
    'sfx_cover_broken',
    'sfx_bump_warning',
  ],
  deathCue: [
    'sfx_enemy_death',
    'sfx_bsod_fatal',
    'sfx_cover_broken',
  ],
  interactCue: [
    'sfx_prop_search',
    'sfx_item_pickup',
    'sfx_currency_pickup',
    'sfx_vent_purge',
    'sfx_lock_keycard',
    'sfx_lock_overclock',
    'sfx_dead_drop_uplink',
    'sfx_anchor_handshake',
    'sfx_anchor_descend',
    'sfx_extract_success',
  ],
  cueId: [
    'amb_emitter_vent',
    'amb_emitter_anchor',
    'amb_emitter_corrupted',
    'amb_band_1_corrupted',
    'amb_band_2_static',
    'amb_band_3_logic',
    'amb_hub_deck',
    'amb_main_menu',
  ],
};

export function AudioCuePicker({
  value,
  onChange,
  fieldKey = '',
  componentKey = '',
  pitchMultiplier = 1.0,
  volumeMultiplier = 1.0,
  disabled = false,
}: Props) {
  // Preload from static JSON with fallback
  const [cues, setCues] = useState<SoundCueDef[]>(() => {
    return (soundCuesRaw.cues as SoundCueDef[]) || [];
  });
  const [isManualInput, setIsManualInput] = useState<boolean>(false);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  // Dynamically fetch any newly created cues from server
  useEffect(() => {
    fetch('/api/dev/gamedata/audio-cues')
      .then((res) => {
        if (!res.ok) return null;
        return res.json();
      })
      .then((data) => {
        if (data?.cues && Array.isArray(data.cues)) {
          setCues(data.cues);
        }
      })
      .catch(() => {
        // Fall back to static soundCuesRaw if API is unreachable
      });
  }, []);

  const cuesMap = useMemo(() => {
    const map = new Map<string, SoundCueDef>();
    for (const cue of cues) {
      map.set(cue.id, cue);
    }
    return map;
  }, [cues]);

  // Group cues by bus
  const groupedCues = useMemo(() => {
    const sfx: SoundCueDef[] = [];
    const ui: SoundCueDef[] = [];
    const ambiance: SoundCueDef[] = [];

    for (const cue of cues) {
      if (cue.bus === 'ui') {
        ui.push(cue);
      } else if (cue.bus === 'ambiance') {
        ambiance.push(cue);
      } else {
        sfx.push(cue);
      }
    }

    sfx.sort((a, b) => a.id.localeCompare(b.id));
    ui.sort((a, b) => a.id.localeCompare(b.id));
    ambiance.sort((a, b) => a.id.localeCompare(b.id));

    return { sfx, ui, ambiance };
  }, [cues]);

  // Recommended cues for this specific field
  const recommendedCueIds = RECOMMENDED_CUES_MAP[fieldKey] || [];
  const recommendedCues = useMemo(() => {
    return recommendedCueIds
      .map((id) => cuesMap.get(id))
      .filter((c): c is SoundCueDef => Boolean(c));
  }, [recommendedCueIds, cuesMap]);

  // Check if current value is custom (not in catalog)
  const isCustomValue = Boolean(value && !cuesMap.has(value));

  // Unmount cleanup: stop any playing audition
  useEffect(() => {
    return () => {
      if (value) {
        getAudioEngine().stopCue(value);
      }
    };
  }, [value]);

  const handleTogglePlay = useCallback(() => {
    if (!value) return;
    const engine = getAudioEngine();

    if (isPlaying) {
      engine.stopCue(value);
      setIsPlaying(false);
      return;
    }

    const existing = cuesMap.get(value);
    const cueToPlay: SoundCueDef = existing || {
      id: value,
      bus: 'sfx',
      mode: 'synth',
      baseVolume: 0.8,
      cooldownMs: 0,
      pitchVariance: 0,
      synth: {
        waveform: 'triangle',
        freqStart: 440,
        attack: 0.01,
        decay: 0.1,
        sustain: 0.3,
        hold: 0.05,
        release: 0.1,
      },
    };

    setIsPlaying(true);
    engine.playCue(cueToPlay, {
      volumeMultiplier: Number(volumeMultiplier) || 1.0,
      pitchMultiplier: Number(pitchMultiplier) || 1.0,
    });

    if (!cueToPlay.loop) {
      const dur = cueToPlay.synth
        ? (cueToPlay.synth.attack +
            cueToPlay.synth.decay +
            cueToPlay.synth.hold +
            cueToPlay.synth.release +
            0.5) *
          1000
        : 800;
      const resetTimer = setTimeout(() => {
        setIsPlaying(false);
      }, Math.max(dur, 400));

      return () => clearTimeout(resetTimer);
    }
  }, [value, isPlaying, cuesMap, volumeMultiplier, pitchMultiplier]);

  const selectId = `audio-cue-${componentKey}-${fieldKey}`;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, width: '100%' }}>
      {isManualInput ? (
        <input
          id={selectId}
          type="text"
          className={styles.fieldInput}
          value={value || ''}
          placeholder="Enter cue ID (e.g. sfx_step_player)"
          onChange={(e) => {
            const trimmed = e.target.value.trim();
            onChange(trimmed || undefined);
          }}
          disabled={disabled}
          style={{ flex: 1 }}
        />
      ) : (
        <select
          id={selectId}
          className={styles.fieldSelect}
          value={value || ''}
          onChange={(e) => {
            const val = e.target.value;
            onChange(val || undefined);
          }}
          disabled={disabled}
          style={{ flex: 1 }}
        >
          <option value="">-- None (No Sound) --</option>

          {isCustomValue && (
            <optgroup label="CUSTOM CUE ID">
              <option value={value}>[Custom] {value}</option>
            </optgroup>
          )}

          {recommendedCues.length > 0 && (
            <optgroup label={`RECOMMENDED FOR ${fieldKey.toUpperCase()}`}>
              {recommendedCues.map((c) => (
                <option key={`rec-${c.id}`} value={c.id}>
                  ★ {c.id} ({c.mode})
                </option>
              ))}
            </optgroup>
          )}

          <optgroup label="SFX (COMBAT, MOVEMENT & PROPS)">
            {groupedCues.sfx.map((c) => (
              <option key={c.id} value={c.id}>
                {c.id}
              </option>
            ))}
          </optgroup>

          <optgroup label="UI (INTERFACES & LEVERS)">
            {groupedCues.ui.map((c) => (
              <option key={c.id} value={c.id}>
                {c.id}
              </option>
            ))}
          </optgroup>

          <optgroup label="AMBIANCE (DRONES & WORLD EMITTERS)">
            {groupedCues.ambiance.map((c) => (
              <option key={c.id} value={c.id}>
                {c.id}
              </option>
            ))}
          </optgroup>
        </select>
      )}

      {/* Audition Button */}
      <button
        type="button"
        className={styles.toolButton}
        onClick={handleTogglePlay}
        disabled={!value || disabled}
        title={
          isPlaying
            ? `Stop ${value}`
            : value
              ? `Audition ${value} (Pitch: ${pitchMultiplier}x, Vol: ${volumeMultiplier}x)`
              : 'Select a cue to audition'
        }
        style={{
          padding: '4px 8px',
          minWidth: '32px',
          color: isPlaying
            ? 'var(--c-danger, #ff2a4b)'
            : value
              ? 'var(--c-accent, #d8ff00)'
              : 'var(--c-text-dim, #79889e)',
          borderColor: isPlaying
            ? 'var(--c-danger, #ff2a4b)'
            : value
              ? 'var(--c-accent, #d8ff00)'
              : 'var(--c-border, #1c2638)',
          cursor: value && !disabled ? 'pointer' : 'not-allowed',
        }}
        aria-label={isPlaying ? `Stop ${value}` : value ? `Audition ${value}` : 'Audition cue'}
      >
        {isPlaying ? '■' : '▶'}
      </button>

      {/* Manual / Dropdown Mode Toggle */}
      <button
        type="button"
        className={styles.toolButton}
        onClick={() => setIsManualInput(!isManualInput)}
        disabled={disabled}
        title={isManualInput ? 'Switch to dropdown selection' : 'Switch to manual text input'}
        style={{
          padding: '4px 6px',
          fontSize: '10px',
          color: isManualInput ? 'var(--c-warning, #ff6600)' : 'var(--c-accent-secondary, #00f0ff)',
        }}
      >
        {isManualInput ? 'LIST' : 'MANUAL'}
      </button>

      {/* Quick Clear Button */}
      {value && !disabled && (
        <button
          type="button"
          className={styles.toolButton}
          onClick={() => onChange(undefined)}
          title="Clear cue"
          style={{
            padding: '4px 6px',
            fontSize: '10px',
            color: 'var(--c-danger, #ff2a4b)',
          }}
        >
          ✕
        </button>
      )}
    </div>
  );
}
export default AudioCuePicker;
