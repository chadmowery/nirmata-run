'use client';

import { useState } from 'react';
import { postHotloadPreview } from '@dev-tool/hotload/studio-sync';
import type { EnvOverridePayload } from '@dev-tool/hotload/types';
import type { SectorCondition } from '@shared/components/environment';
import { StudioFieldHint, StudioSliderField } from './StudioSliderField';
import styles from '../editors/editors.module.css';

const FACTION_OPTIONS = [
  { value: '', label: 'FOLLOW FLOOR' },
  { value: 'cyberacme', label: 'cyberacme' },
  { value: 'traxus_foundry', label: 'traxus_foundry' },
  { value: 'sekiguchi_biolabs', label: 'sekiguchi_biolabs' },
  { value: 'dark_subnet', label: 'dark_subnet' },
  { value: 'nucaloric', label: 'nucaloric' },
];

const CONDITION_OPTIONS = [
  { value: '', label: 'FOLLOW FLOOR' },
  { value: 'NOMINAL', label: 'NOMINAL' },
  { value: 'THERMAL_SURGE', label: 'THERMAL_SURGE' },
  { value: 'DARK_SUBNET', label: 'DARK_SUBNET' },
  { value: 'OVERCLOCKED_GRID', label: 'OVERCLOCKED_GRID' },
];

export function EnvironmentOverrideBar() {
  const [factionTheme, setFactionTheme] = useState<string>('');
  const [sectorCondition, setSectorCondition] = useState<string>('');
  const [heatPercent, setHeatPercent] = useState<number | null>(null);
  const [stabilityPercent, setStabilityPercent] = useState<number | null>(null);

  const emitOverride = (next: {
    factionTheme: string;
    sectorCondition: string;
    heatPercent: number | null;
    stabilityPercent: number | null;
  }) => {
    const payload: EnvOverridePayload = {
      factionTheme: next.factionTheme ? next.factionTheme : null,
      sectorCondition: next.sectorCondition ? (next.sectorCondition as SectorCondition) : null,
      heatPercent: next.heatPercent,
      stabilityPercent: next.stabilityPercent,
    };
    postHotloadPreview('env:override', 'active-floor', payload, 16);
  };

  return (
    <div
      className={styles.fieldGroup}
      style={{
        borderColor: 'rgba(0, 240, 255, 0.35)',
        background: 'rgba(11, 17, 30, 0.85)',
        padding: '8px 12px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '10px',
        }}
      >
        <span style={{ fontSize: '11px', fontWeight: 700, color: '#00f0ff' }}>
          ENV PREVIEW OVERRIDE (LIVE VISUAL ONLY)
        </span>
        <button
          type="button"
          className={styles.toolButton}
          style={{ fontSize: '10px', padding: '2px 8px' }}
          onClick={() => {
            const reset = {
              factionTheme: '',
              sectorCondition: '',
              heatPercent: null,
              stabilityPercent: null,
            };
            setFactionTheme('');
            setSectorCondition('');
            setHeatPercent(null);
            setStabilityPercent(null);
            emitOverride(reset);
          }}
        >
          ↺ RESET OVERRIDES
        </button>
      </div>

      <div className={styles.fieldGridCompact} style={{ marginTop: '8px' }}>
        <div className={styles.fieldCell}>
          <div className={styles.fieldCellHeader}>
            <label htmlFor="env-override-faction" className={styles.fieldCellLabel}>
              Faction Theme
            </label>
            <StudioFieldHint
              label="Faction Theme"
              tooltipTag="ENV"
              tooltip="Temporarily overrides the running floor's faction lighting and tileset theme without regenerating the floor."
            />
          </div>
          <select
            id="env-override-faction"
            className={styles.fieldSelect}
            value={factionTheme}
            onChange={(e) => {
              const val = e.target.value;
              setFactionTheme(val);
              emitOverride({ factionTheme: val, sectorCondition, heatPercent, stabilityPercent });
            }}
          >
            {FACTION_OPTIONS.map((opt) => (
              <option key={opt.value || 'follow'} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.fieldCell}>
          <div className={styles.fieldCellHeader}>
            <label htmlFor="env-override-condition" className={styles.fieldCellLabel}>
              Sector Condition
            </label>
            <StudioFieldHint
              label="Sector Condition"
              tooltipTag="ENV"
              tooltip="Temporarily previews any sector condition's lighting, pulse, jitter, and audio filter profile on the live floor."
            />
          </div>
          <select
            id="env-override-condition"
            className={styles.fieldSelect}
            value={sectorCondition}
            onChange={(e) => {
              const val = e.target.value;
              setSectorCondition(val);
              emitOverride({ factionTheme, sectorCondition: val, heatPercent, stabilityPercent });
            }}
          >
            {CONDITION_OPTIONS.map((opt) => (
              <option key={opt.value || 'follow'} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <StudioSliderField
          label="Heat Preview"
          valueDisplay={heatPercent === null ? 'LIVE' : `${heatPercent}%`}
          tooltipTag="ENV"
          tooltip="Overrides the client Heat shader and audio escalation tier (0–100%) in real time for visual/audio testing without mutating server gameplay."
          min={0}
          max={100}
          step={1}
          value={heatPercent ?? 0}
          onChange={(val) => {
            setHeatPercent(val);
            emitOverride({ factionTheme, sectorCondition, heatPercent: val, stabilityPercent });
          }}
        />

        <StudioSliderField
          label="Stability Preview"
          valueDisplay={stabilityPercent === null ? 'LIVE' : `${stabilityPercent}%`}
          tooltipTag="ENV"
          tooltip="Overrides the client Stability Anchor grayscale and audio lowpass ducking level (0–100%) in real time for visual/audio testing."
          min={0}
          max={100}
          step={1}
          value={stabilityPercent ?? 100}
          onChange={(val) => {
            setStabilityPercent(val);
            emitOverride({ factionTheme, sectorCondition, heatPercent, stabilityPercent: val });
          }}
        />
      </div>
    </div>
  );
}
