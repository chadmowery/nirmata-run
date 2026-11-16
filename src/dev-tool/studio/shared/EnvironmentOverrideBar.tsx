'use client';

import { useState } from 'react';
import { postHotloadPreview } from '@dev-tool/hotload/studio-sync';
import type { EnvOverridePayload } from '@dev-tool/hotload/types';
import type { SectorCondition } from '@shared/components/environment';
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

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
          gap: '8px',
          marginTop: '8px',
        }}
      >
        <div className={styles.fieldRow}>
          <label className={styles.fieldLabel}>Faction Theme</label>
          <select
            className={styles.fieldInput}
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

        <div className={styles.fieldRow}>
          <label className={styles.fieldLabel}>Sector Condition</label>
          <select
            className={styles.fieldInput}
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

        <div className={styles.fieldRow}>
          <label className={styles.fieldLabel}>
            Heat Preview: {heatPercent === null ? 'LIVE' : `${heatPercent}%`}
          </label>
          <input
            type="range"
            min={0}
            max={100}
            value={heatPercent ?? 0}
            onChange={(e) => {
              const val = Number(e.target.value);
              setHeatPercent(val);
              emitOverride({ factionTheme, sectorCondition, heatPercent: val, stabilityPercent });
            }}
          />
        </div>

        <div className={styles.fieldRow}>
          <label className={styles.fieldLabel}>
            Stability Preview: {stabilityPercent === null ? 'LIVE' : `${stabilityPercent}%`}
          </label>
          <input
            type="range"
            min={0}
            max={100}
            value={stabilityPercent ?? 100}
            onChange={(e) => {
              const val = Number(e.target.value);
              setStabilityPercent(val);
              emitOverride({ factionTheme, sectorCondition, heatPercent, stabilityPercent: val });
            }}
          />
        </div>
      </div>
    </div>
  );
}
