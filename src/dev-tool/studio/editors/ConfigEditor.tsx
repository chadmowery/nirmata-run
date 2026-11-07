'use client';
import { useState, useEffect, useCallback } from 'react';
import { useGamedataStore } from '../store';
import { AudioCuePicker } from '../shared/AudioCuePicker';
import styles from './editors.module.css';

interface Props {
  name: string;
  onRefresh?: () => void;
}

interface DepthBandConfig {
  range: { min: number; max: number };
  label: string;
  palette: { floor: string; wall: string; tint: string };
  bspConfig?: Record<string, unknown>;
  specialRoomProbability?: Record<string, number>;
}

interface LootItem {
  template: string;
  weight: number;
  note?: string;
}

interface LootBandConfig {
  depthRange: { min: number; max: number };
  loot: LootItem[];
}

interface AmbianceSceneTrackConfig {
  cueId: string;
  samplePath?: string;
  description?: string;
}

interface AmbianceDepthBandItemConfig {
  id: string;
  label: string;
  floorRange: { min: number; max: number };
  cueId: string;
  samplePath?: string;
  baseVolume: number;
  description?: string;
}

interface AmbianceSectorConditionItemConfig {
  condition: string;
  cueId?: string;
  samplePath?: string;
  cutoffMultiplier: number;
  resonanceQ: number;
  description?: string;
}

interface AmbianceDuckingItemConfig {
  stabilityAnchorCutoffHz: number;
  pauseMenuCutoffHz: number;
  duckingRampDurationSec: number;
  crossfadeDurationSec: number;
}

export function ConfigEditor({ name, onRefresh }: Props) {
  const { setDirty, setActiveEffectiveData, setActiveValidationStatus } = useGamedataStore();
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [editMode, setEditMode] = useState<'structured' | 'raw'>('structured');
  const [rawText, setRawText] = useState('');
  const [rawError, setRawError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/dev/gamedata/configs/${name}`)
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setRawText(JSON.stringify(d, null, 2));
        setDirty(false);
      })
      .catch(() => setErrors(['Failed to load config']));
  }, [name, setDirty]);

  // Sync to store
  useEffect(() => {
    if (data) {
      setActiveEffectiveData(data);
      setActiveValidationStatus({ zodValid: true });
    }
  }, [data, setActiveEffectiveData, setActiveValidationStatus]);

  const handleSave = useCallback(async () => {
    if (!data) return;
    setSaveStatus('saving');
    setErrors([]);

    let payload = data;
    if (editMode === 'raw') {
      try {
        payload = JSON.parse(rawText);
      } catch (err) {
        setErrors([`JSON Syntax Error: ${err instanceof Error ? err.message : 'Invalid JSON'}`]);
        setSaveStatus('error');
        return;
      }
    }

    try {
      const res = await fetch(`/api/dev/gamedata/configs/${name}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to save config');
      }

      setData(payload);
      setRawText(JSON.stringify(payload, null, 2));
      setSaveStatus('success');
      setDirty(false);
      onRefresh?.();
    } catch (err) {
      setErrors([err instanceof Error ? err.message : 'Save failed']);
      setSaveStatus('error');
    }
  }, [data, editMode, rawText, name, setDirty, onRefresh]);

  useEffect(() => {
    const onSaveKey = () => handleSave();
    window.addEventListener('gamedata-save', onSaveKey);
    return () => window.removeEventListener('gamedata-save', onSaveKey);
  }, [handleSave]);

  if (!data) return <div>Loading config...</div>;

  return (
    <div className={styles.editor}>
      <div className={styles.editorHeader}>
        <h2 className={styles.editorTitle}>System Config: {name}</h2>
        <div className={styles.buttonRow}>
          <button
            type="button"
            className={styles.toolButton}
            onClick={() => {
              if (editMode === 'structured') {
                setRawText(JSON.stringify(data, null, 2));
                setEditMode('raw');
              } else {
                try {
                  const parsed = JSON.parse(rawText);
                  setData(parsed);
                  setRawError(null);
                  setEditMode('structured');
                } catch (e) {
                  setRawError(e instanceof Error ? e.message : 'Invalid JSON');
                }
              }
            }}
          >
            {editMode === 'structured' ? 'SWITCH TO RAW JSON' : 'SWITCH TO FORM VIEW'}
          </button>
          <button
            className={styles.saveButton}
            onClick={handleSave}
            disabled={saveStatus === 'saving'}
          >
            {saveStatus === 'saving' ? 'SAVING...' : 'SAVE'}
          </button>
        </div>
      </div>

      {errors.length > 0 && <div className={styles.errorMessage}>{errors.join(', ')}</div>}
      {rawError && <div className={styles.errorMessage}>Syntax: {rawError}</div>}

      {editMode === 'raw' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', height: 'calc(100vh - 180px)' }}>
          <textarea
            className={styles.fieldInput}
            style={{
              flex: 1,
              fontFamily: 'var(--font-mono, monospace)',
              fontSize: '12px',
              lineHeight: 1.5,
              whiteSpace: 'pre',
            }}
            value={rawText}
            onChange={(e) => {
              setRawText(e.target.value);
              setDirty(true);
            }}
          />
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Economy Editor */}
          {name === 'economy' && (
            <>
              {/* Currency Caps & Pity */}
              <div className={styles.fieldGroup}>
                <h3 className={styles.fieldGroupTitle}>Caps & Pity Settings</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px' }}>
                  <div className={styles.fieldRow}>
                    <label className={styles.fieldLabel}>Scrap Cap</label>
                    <input
                      type="number"
                      className={styles.fieldInput}
                      value={(data.caps as Record<string, number>)?.scrap ?? 10000}
                      onChange={(e) => {
                        const caps = { ...(data.caps as Record<string, number>), scrap: Number(e.target.value) };
                        setData({ ...data, caps });
                        setDirty(true);
                      }}
                    />
                  </div>
                  <div className={styles.fieldRow}>
                    <label className={styles.fieldLabel}>Flux Cap</label>
                    <input
                      type="number"
                      className={styles.fieldInput}
                      value={(data.caps as Record<string, number>)?.flux ?? 1000}
                      onChange={(e) => {
                        const caps = { ...(data.caps as Record<string, number>), flux: Number(e.target.value) };
                        setData({ ...data, caps });
                        setDirty(true);
                      }}
                    />
                  </div>
                  <div className={styles.fieldRow}>
                    <label className={styles.fieldLabel}>Death Scrap Pity %</label>
                    <input
                      type="number"
                      step="0.05"
                      className={styles.fieldInput}
                      value={(data.pity as Record<string, number>)?.deathScrapPercent ?? 0.25}
                      onChange={(e) => {
                        const pity = { ...(data.pity as Record<string, number>), deathScrapPercent: Number(e.target.value) };
                        setData({ ...data, pity });
                        setDirty(true);
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Compilation & Installation Costs */}
              <div className={styles.fieldGroup}>
                <h3 className={styles.fieldGroupTitle}>Software & Augment Compilation Costs</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px' }}>
                  {(['common', 'uncommon', 'rare', 'legendary'] as const).map((tier) => (
                    <div key={tier} className={styles.fieldRow}>
                      <label className={styles.fieldLabel} style={{ textTransform: 'capitalize' }}>{tier}</label>
                      <input
                        type="number"
                        className={styles.fieldInput}
                        value={
                          ((data.costs as Record<string, Record<string, number>>)?.compilation?.[tier]) ?? 0
                        }
                        onChange={(e) => {
                          const costs = { ...(data.costs as Record<string, Record<string, number>>) };
                          costs.compilation = { ...costs.compilation, [tier]: Number(e.target.value) };
                          setData({ ...data, costs });
                          setDirty(true);
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Scoring Weights */}
              <div className={styles.fieldGroup}>
                <h3 className={styles.fieldGroupTitle}>Run Scoring Weights</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px' }}>
                  {Object.entries((data.scoring as Record<string, number>) || {}).map(([key, val]) => (
                    <div key={key} className={styles.fieldRow}>
                      <label className={styles.fieldLabel}>{key}</label>
                      <input
                        type="number"
                        className={styles.fieldInput}
                        value={val}
                        onChange={(e) => {
                          const scoring = { ...(data.scoring as Record<string, number>), [key]: Number(e.target.value) };
                          setData({ ...data, scoring });
                          setDirty(true);
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Depth Config Editor */}
          {name === 'depth-config' && (
            <>
              {(((data.depthBands as DepthBandConfig[]) || [])).map((band, idx) => (
                <div key={idx} className={styles.fieldGroup}>
                  <div className={styles.fieldGroupHeader}>
                    <span className={styles.fieldGroupTitle}>
                      Depth Band {idx + 1}: {band.label} (F{band.range.min}–F{band.range.max})
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px', marginBottom: '8px' }}>
                    <div className={styles.fieldRow}>
                      <label className={styles.fieldLabel}>Floor Range</label>
                      <input
                        type="number"
                        className={styles.fieldInput}
                        value={band.range.min}
                        onChange={(e) => {
                          const bands = [...(data.depthBands as DepthBandConfig[])];
                          bands[idx].range.min = Number(e.target.value);
                          setData({ ...data, depthBands: bands });
                          setDirty(true);
                        }}
                      />
                      <span style={{ padding: '0 4px', opacity: 0.6 }}>to</span>
                      <input
                        type="number"
                        className={styles.fieldInput}
                        value={band.range.max}
                        onChange={(e) => {
                          const bands = [...(data.depthBands as DepthBandConfig[])];
                          bands[idx].range.max = Number(e.target.value);
                          setData({ ...data, depthBands: bands });
                          setDirty(true);
                        }}
                      />
                    </div>

                    <div className={styles.fieldRow}>
                      <label className={styles.fieldLabel}>Label</label>
                      <input
                        className={styles.fieldInput}
                        value={band.label}
                        onChange={(e) => {
                          const bands = [...(data.depthBands as DepthBandConfig[])];
                          bands[idx].label = e.target.value;
                          setData({ ...data, depthBands: bands });
                          setDirty(true);
                        }}
                      />
                    </div>
                  </div>

                  {/* Palette Colors */}
                  <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginTop: '6px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--c-text-dim, #79889e)' }}>PALETTE:</span>
                    {(['floor', 'wall', 'tint'] as const).map((colorKey) => {
                      const hex = band.palette?.[colorKey] || '0x000000';
                      const cssColor = hex.replace('0x', '#');
                      return (
                        <div key={colorKey} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <div
                            style={{
                              width: '16px',
                              height: '16px',
                              background: cssColor,
                              border: '1px solid var(--c-border-bright, #36445d)',
                              borderRadius: '2px',
                            }}
                          />
                          <span style={{ fontSize: '11px', textTransform: 'capitalize' }}>{colorKey}:</span>
                          <input
                            className={styles.fieldInput}
                            style={{ width: '84px', fontFamily: 'var(--font-mono, monospace)', fontSize: '11px' }}
                            value={hex}
                            onChange={(e) => {
                              const bands = [...(data.depthBands as DepthBandConfig[])];
                              bands[idx].palette[colorKey] = e.target.value;
                              setData({ ...data, depthBands: bands });
                              setDirty(true);
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </>
          )}

          {/* Loot Distribution Editor */}
          {name === 'loot-distribution' && (
            <>
              {(((data.depthBands as LootBandConfig[]) || [])).map((band, idx) => {
                const totalWeight = (band.loot || []).reduce((sum, l) => sum + (l.weight || 0), 0);
                return (
                  <div key={idx} className={styles.fieldGroup}>
                    <div className={styles.fieldGroupHeader}>
                      <span className={styles.fieldGroupTitle}>
                        Depth Band {idx + 1} (F{band.depthRange.min}–F{band.depthRange.max}) — {band.loot?.length || 0} items
                      </span>
                    </div>

                    <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {(band.loot || []).map((l, lIdx) => {
                        const pct = totalWeight > 0 ? ((l.weight / totalWeight) * 100).toFixed(1) : '0';
                        return (
                          <div
                            key={lIdx}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              background: 'var(--c-surface, #0a0e15)',
                              padding: '6px 10px',
                              borderRadius: '2px',
                              border: '1px solid var(--c-border, #1c2638)',
                            }}
                          >
                            <input
                              className={styles.fieldInput}
                              value={l.template}
                              placeholder="template name"
                              onChange={(e) => {
                                const bands = [...(data.depthBands as LootBandConfig[])];
                                bands[idx].loot[lIdx].template = e.target.value;
                                setData({ ...data, depthBands: bands });
                                setDirty(true);
                              }}
                              style={{ flex: 2 }}
                            />
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <span style={{ fontSize: '11px', color: 'var(--c-text-dim, #79889e)' }}>Weight:</span>
                              <input
                                type="number"
                                className={styles.fieldInput}
                                style={{ width: '60px' }}
                                value={l.weight}
                                onChange={(e) => {
                                  const bands = [...(data.depthBands as LootBandConfig[])];
                                  bands[idx].loot[lIdx].weight = Number(e.target.value);
                                  setData({ ...data, depthBands: bands });
                                  setDirty(true);
                                }}
                              />
                              <span
                                style={{
                                  fontSize: '11px',
                                  fontFamily: 'var(--font-mono, monospace)',
                                  color: 'var(--c-accent, #d8ff00)',
                                  minWidth: '46px',
                                }}
                              >
                                {pct}%
                              </span>
                            </div>
                            <button
                              type="button"
                              className={styles.toolButton}
                              onClick={() => {
                                const bands = [...(data.depthBands as LootBandConfig[])];
                                bands[idx].loot = bands[idx].loot.filter((_, i) => i !== lIdx);
                                setData({ ...data, depthBands: bands });
                                setDirty(true);
                              }}
                              style={{ color: 'var(--c-danger, #ff2a4b)', padding: '2px 6px', fontSize: '11px' }}
                            >
                              ×
                            </button>
                          </div>
                        );
                      })}
                      <button
                        type="button"
                        className={styles.addButton}
                        onClick={() => {
                          const bands = [...(data.depthBands as LootBandConfig[])];
                          bands[idx].loot = [...(bands[idx].loot || []), { template: 'bleed-v0', weight: 10 }];
                          setData({ ...data, depthBands: bands });
                          setDirty(true);
                        }}
                        style={{ alignSelf: 'flex-start', marginTop: '4px' }}
                      >
                        + Add Drop Entry
                      </button>
                    </div>
                  </div>
                );
              })}
            </>
          )}

          {/* Ambiance System Config Editor */}
          {name === 'ambiance' && (
            <>
              {/* Scene Ambiance Tracks */}
              <div className={styles.fieldGroup}>
                <h3 className={styles.fieldGroupTitle}>Scene Ambiance Tracks</h3>
                <p style={{ fontSize: '11px', color: 'var(--c-text-dim, #79889e)', margin: '0 0 12px 0' }}>
                  Continuous background drones and atmosphere for global menus and safe hub environments.
                </p>

                {['mainMenu', 'hub'].map((sceneKey) => {
                  const scenes = (data.scenes as Record<string, AmbianceSceneTrackConfig>) || {};
                  const scene = scenes[sceneKey] || { cueId: '' };
                  const title = sceneKey === 'mainMenu' ? 'Main Menu (Oscilloscope Drone)' : 'Hub Deck (Safe Zone Air & Data Pulse)';

                  return (
                    <div
                      key={sceneKey}
                      style={{
                        background: 'var(--c-surface, #0a0e15)',
                        padding: '10px 12px',
                        borderRadius: '2px',
                        border: '1px solid var(--c-border, #1c2638)',
                        marginBottom: '10px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--c-accent-secondary, #00f0ff)' }}>
                          {title}
                        </span>
                        <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono, monospace)', color: 'var(--c-text-dim, #79889e)' }}>
                          scenes.{sceneKey}
                        </span>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label className={styles.fieldLabel}>Audio Cue ID</label>
                          <AudioCuePicker
                            value={scene.cueId}
                            onChange={(newCueId) => {
                              const newScenes = { ...scenes, [sceneKey]: { ...scene, cueId: newCueId || '' } };
                              setData({ ...data, scenes: newScenes });
                              setDirty(true);
                            }}
                            fieldKey="cueId"
                          />
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label className={styles.fieldLabel}>Sample File Path (Optional Override)</label>
                          <input
                            className={styles.fieldInput}
                            placeholder="e.g. /audio/tracks/main_menu_drone.mp3"
                            value={scene.samplePath || ''}
                            onChange={(e) => {
                              const newScenes = { ...scenes, [sceneKey]: { ...scene, samplePath: e.target.value } };
                              setData({ ...data, scenes: newScenes });
                              setDirty(true);
                            }}
                          />
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label className={styles.fieldLabel}>Description</label>
                        <input
                          className={styles.fieldInput}
                          placeholder="Scene description"
                          value={scene.description || ''}
                          onChange={(e) => {
                            const newScenes = { ...scenes, [sceneKey]: { ...scene, description: e.target.value } };
                            setData({ ...data, scenes: newScenes });
                            setDirty(true);
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Progression Depth Bands */}
              <div className={styles.fieldGroup}>
                <div className={styles.fieldGroupHeader}>
                  <div>
                    <h3 className={styles.fieldGroupTitle} style={{ margin: 0 }}>
                      Progression Depth Bands (Floor Ambiance)
                    </h3>
                    <p style={{ fontSize: '11px', color: 'var(--c-text-dim, #79889e)', margin: '4px 0 0 0' }}>
                      Authoritative dungeon floor depth bands mapped to procedural run depths.
                    </p>
                  </div>
                  <button
                    type="button"
                    className={styles.addButton}
                    onClick={() => {
                      const bands = [...((data.depthBands as AmbianceDepthBandItemConfig[]) || [])];
                      const lastMax = bands.length > 0 ? bands[bands.length - 1].floorRange.max : 0;
                      const newBand: AmbianceDepthBandItemConfig = {
                        id: `band_${bands.length + 1}_custom`,
                        label: `SECTOR_${bands.length + 1}`,
                        floorRange: { min: lastMax + 1, max: lastMax + 5 },
                        cueId: 'amb_band_1_corrupted',
                        baseVolume: 0.65,
                        description: `Floors ${lastMax + 1}–${lastMax + 5} atmospheric ambiance`,
                      };
                      setData({ ...data, depthBands: [...bands, newBand] });
                      setDirty(true);
                    }}
                  >
                    + ADD DEPTH BAND
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '10px' }}>
                  {(((data.depthBands as AmbianceDepthBandItemConfig[]) || [])).map((band, idx) => (
                    <div
                      key={band.id || idx}
                      style={{
                        background: 'var(--c-surface, #0a0e15)',
                        padding: '12px',
                        borderRadius: '2px',
                        border: '1px solid var(--c-border, #1c2638)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--c-accent, #d8ff00)' }}>
                          Band {idx + 1}: {band.label} (Floors {band.floorRange?.min}–{band.floorRange?.max})
                        </span>
                        <button
                          type="button"
                          className={styles.toolButton}
                          onClick={() => {
                            const bands = [...((data.depthBands as AmbianceDepthBandItemConfig[]) || [])];
                            setData({ ...data, depthBands: bands.filter((_, i) => i !== idx) });
                            setDirty(true);
                          }}
                          style={{ color: 'var(--c-danger, #ff2a4b)', padding: '2px 8px', fontSize: '11px' }}
                        >
                          REMOVE BAND
                        </button>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px' }}>
                        <div className={styles.fieldRow}>
                          <label className={styles.fieldLabel} style={{ minWidth: '90px' }}>Band ID</label>
                          <input
                            className={styles.fieldInput}
                            value={band.id}
                            onChange={(e) => {
                              const bands = [...((data.depthBands as AmbianceDepthBandItemConfig[]) || [])];
                              bands[idx] = { ...bands[idx], id: e.target.value };
                              setData({ ...data, depthBands: bands });
                              setDirty(true);
                            }}
                          />
                        </div>

                        <div className={styles.fieldRow}>
                          <label className={styles.fieldLabel} style={{ minWidth: '90px' }}>Label</label>
                          <input
                            className={styles.fieldInput}
                            value={band.label}
                            onChange={(e) => {
                              const bands = [...((data.depthBands as AmbianceDepthBandItemConfig[]) || [])];
                              bands[idx] = { ...bands[idx], label: e.target.value };
                              setData({ ...data, depthBands: bands });
                              setDirty(true);
                            }}
                          />
                        </div>

                        <div className={styles.fieldRow}>
                          <label className={styles.fieldLabel} style={{ minWidth: '90px' }}>Floor Range</label>
                          <input
                            type="number"
                            className={styles.fieldInput}
                            style={{ width: '60px' }}
                            value={band.floorRange?.min ?? 1}
                            onChange={(e) => {
                              const bands = [...((data.depthBands as AmbianceDepthBandItemConfig[]) || [])];
                              bands[idx] = {
                                ...bands[idx],
                                floorRange: { ...bands[idx].floorRange, min: parseInt(e.target.value, 10) || 1 },
                              };
                              setData({ ...data, depthBands: bands });
                              setDirty(true);
                            }}
                          />
                          <span style={{ padding: '0 4px', opacity: 0.6 }}>to</span>
                          <input
                            type="number"
                            className={styles.fieldInput}
                            style={{ width: '60px' }}
                            value={band.floorRange?.max ?? 1}
                            onChange={(e) => {
                              const bands = [...((data.depthBands as AmbianceDepthBandItemConfig[]) || [])];
                              bands[idx] = {
                                ...bands[idx],
                                floorRange: { ...bands[idx].floorRange, max: parseInt(e.target.value, 10) || 1 },
                              };
                              setData({ ...data, depthBands: bands });
                              setDirty(true);
                            }}
                          />
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label className={styles.fieldLabel}>Audio Cue ID</label>
                          <AudioCuePicker
                            value={band.cueId}
                            onChange={(newCueId) => {
                              const bands = [...((data.depthBands as AmbianceDepthBandItemConfig[]) || [])];
                              bands[idx] = { ...bands[idx], cueId: newCueId || '' };
                              setData({ ...data, depthBands: bands });
                              setDirty(true);
                            }}
                            fieldKey="cueId"
                          />
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label className={styles.fieldLabel}>Sample File Path (Optional Override)</label>
                          <input
                            className={styles.fieldInput}
                            placeholder="e.g. /audio/tracks/sector_ambient.mp3"
                            value={band.samplePath || ''}
                            onChange={(e) => {
                              const bands = [...((data.depthBands as AmbianceDepthBandItemConfig[]) || [])];
                              bands[idx] = { ...bands[idx], samplePath: e.target.value };
                              setData({ ...data, depthBands: bands });
                              setDirty(true);
                            }}
                          />
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <label className={styles.fieldLabel} style={{ minWidth: '90px' }}>Base Volume</label>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.05"
                          value={band.baseVolume ?? 0.6}
                          onChange={(e) => {
                            const bands = [...((data.depthBands as AmbianceDepthBandItemConfig[]) || [])];
                            bands[idx] = { ...bands[idx], baseVolume: parseFloat(e.target.value) };
                            setData({ ...data, depthBands: bands });
                            setDirty(true);
                          }}
                        />
                        <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono, monospace)', color: 'var(--c-accent, #d8ff00)', minWidth: '40px' }}>
                          {Math.round((band.baseVolume ?? 0.6) * 100)}%
                        </span>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, marginLeft: '12px' }}>
                          <label className={styles.fieldLabel} style={{ minWidth: '80px' }}>Description</label>
                          <input
                            className={styles.fieldInput}
                            placeholder="Band description"
                            value={band.description || ''}
                            onChange={(e) => {
                              const bands = [...((data.depthBands as AmbianceDepthBandItemConfig[]) || [])];
                              bands[idx] = { ...bands[idx], description: e.target.value };
                              setData({ ...data, depthBands: bands });
                              setDirty(true);
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Sector Conditions & Environmental Filters */}
              <div className={styles.fieldGroup}>
                <div className={styles.fieldGroupHeader}>
                  <div>
                    <h3 className={styles.fieldGroupTitle} style={{ margin: 0 }}>
                      Sector Conditions & Environmental Filter Overrides
                    </h3>
                    <p style={{ fontSize: '11px', color: 'var(--c-text-dim, #79889e)', margin: '4px 0 0 0' }}>
                      Dynamic filter modulations (lowpass frequency cutoff multiplier & resonance Q) or track overrides triggered by environmental conditions.
                    </p>
                  </div>
                  <button
                    type="button"
                    className={styles.addButton}
                    onClick={() => {
                      const conds = [...((data.sectorConditions as AmbianceSectorConditionItemConfig[]) || [])];
                      const newCond: AmbianceSectorConditionItemConfig = {
                        condition: `HAZARD_${conds.length + 1}`,
                        cutoffMultiplier: 0.8,
                        resonanceQ: 2.0,
                        description: 'Custom environmental hazard ambiance',
                      };
                      setData({ ...data, sectorConditions: [...conds, newCond] });
                      setDirty(true);
                    }}
                  >
                    + ADD SECTOR CONDITION
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
                  {(((data.sectorConditions as AmbianceSectorConditionItemConfig[]) || [])).map((cond, idx) => (
                    <div
                      key={idx}
                      style={{
                        background: 'var(--c-surface, #0a0e15)',
                        padding: '10px 12px',
                        borderRadius: '2px',
                        border: '1px solid var(--c-border, #1c2638)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--c-warning, #ff6600)' }}>
                            Condition:
                          </span>
                          <input
                            className={styles.fieldInput}
                            style={{ width: '180px', textTransform: 'uppercase', fontWeight: 700 }}
                            value={cond.condition}
                            onChange={(e) => {
                              const conds = [...((data.sectorConditions as AmbianceSectorConditionItemConfig[]) || [])];
                              conds[idx] = { ...conds[idx], condition: e.target.value.toUpperCase() };
                              setData({ ...data, sectorConditions: conds });
                              setDirty(true);
                            }}
                          />
                        </div>

                        <button
                          type="button"
                          className={styles.toolButton}
                          onClick={() => {
                            const conds = [...((data.sectorConditions as AmbianceSectorConditionItemConfig[]) || [])];
                            setData({ ...data, sectorConditions: conds.filter((_, i) => i !== idx) });
                            setDirty(true);
                          }}
                          style={{ color: 'var(--c-danger, #ff2a4b)', padding: '2px 8px', fontSize: '11px' }}
                        >
                          REMOVE
                        </button>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label className={styles.fieldLabel}>Track Override Cue ID (Optional)</label>
                          <AudioCuePicker
                            value={cond.cueId || ''}
                            onChange={(newCueId) => {
                              const conds = [...((data.sectorConditions as AmbianceSectorConditionItemConfig[]) || [])];
                              conds[idx] = { ...conds[idx], cueId: newCueId || undefined };
                              setData({ ...data, sectorConditions: conds });
                              setDirty(true);
                            }}
                            fieldKey="cueId"
                          />
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label className={styles.fieldLabel}>Sample File Path (Optional Override)</label>
                          <input
                            className={styles.fieldInput}
                            placeholder="e.g. /audio/tracks/thermal_surge.mp3"
                            value={cond.samplePath || ''}
                            onChange={(e) => {
                              const conds = [...((data.sectorConditions as AmbianceSectorConditionItemConfig[]) || [])];
                              conds[idx] = { ...conds[idx], samplePath: e.target.value || undefined };
                              setData({ ...data, sectorConditions: conds });
                              setDirty(true);
                            }}
                          />
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <label className={styles.fieldLabel} style={{ minWidth: '120px' }}>Cutoff Multiplier</label>
                          <input
                            type="range"
                            min="0.1"
                            max="1.5"
                            step="0.05"
                            value={cond.cutoffMultiplier ?? 1.0}
                            onChange={(e) => {
                              const conds = [...((data.sectorConditions as AmbianceSectorConditionItemConfig[]) || [])];
                              conds[idx] = { ...conds[idx], cutoffMultiplier: parseFloat(e.target.value) };
                              setData({ ...data, sectorConditions: conds });
                              setDirty(true);
                            }}
                          />
                          <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono, monospace)', color: 'var(--c-accent, #d8ff00)', minWidth: '40px' }}>
                            {(cond.cutoffMultiplier ?? 1.0).toFixed(2)}×
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <label className={styles.fieldLabel} style={{ minWidth: '100px' }}>Resonance Q</label>
                          <input
                            type="range"
                            min="0.5"
                            max="10.0"
                            step="0.1"
                            value={cond.resonanceQ ?? 1.0}
                            onChange={(e) => {
                              const conds = [...((data.sectorConditions as AmbianceSectorConditionItemConfig[]) || [])];
                              conds[idx] = { ...conds[idx], resonanceQ: parseFloat(e.target.value) };
                              setData({ ...data, sectorConditions: conds });
                              setDirty(true);
                            }}
                          />
                          <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono, monospace)', color: 'var(--c-accent, #d8ff00)', minWidth: '40px' }}>
                            {(cond.resonanceQ ?? 1.0).toFixed(1)} Q
                          </span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label className={styles.fieldLabel}>Description</label>
                        <input
                          className={styles.fieldInput}
                          placeholder="Sector condition description"
                          value={cond.description || ''}
                          onChange={(e) => {
                            const conds = [...((data.sectorConditions as AmbianceSectorConditionItemConfig[]) || [])];
                            conds[idx] = { ...conds[idx], description: e.target.value };
                            setData({ ...data, sectorConditions: conds });
                            setDirty(true);
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Ducking & Dynamic Filter Parameters */}
              <div className={styles.fieldGroup}>
                <h3 className={styles.fieldGroupTitle}>Ducking & Dynamic Filter Parameters</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
                  <div className={styles.fieldRow}>
                    <label className={styles.fieldLabel}>Stability Anchor Cutoff</label>
                    <input
                      type="number"
                      className={styles.fieldInput}
                      value={(data.ducking as AmbianceDuckingItemConfig)?.stabilityAnchorCutoffHz ?? 380}
                      onChange={(e) => {
                        const ducking = { ...((data.ducking as AmbianceDuckingItemConfig) || {}), stabilityAnchorCutoffHz: Number(e.target.value) };
                        setData({ ...data, ducking });
                        setDirty(true);
                      }}
                    />
                    <span style={{ fontSize: '11px', opacity: 0.6 }}>Hz</span>
                  </div>

                  <div className={styles.fieldRow}>
                    <label className={styles.fieldLabel}>Pause Menu Cutoff</label>
                    <input
                      type="number"
                      className={styles.fieldInput}
                      value={(data.ducking as AmbianceDuckingItemConfig)?.pauseMenuCutoffHz ?? 380}
                      onChange={(e) => {
                        const ducking = { ...((data.ducking as AmbianceDuckingItemConfig) || {}), pauseMenuCutoffHz: Number(e.target.value) };
                        setData({ ...data, ducking });
                        setDirty(true);
                      }}
                    />
                    <span style={{ fontSize: '11px', opacity: 0.6 }}>Hz</span>
                  </div>

                  <div className={styles.fieldRow}>
                    <label className={styles.fieldLabel}>Ducking Ramp Duration</label>
                    <input
                      type="number"
                      step="0.05"
                      className={styles.fieldInput}
                      value={(data.ducking as AmbianceDuckingItemConfig)?.duckingRampDurationSec ?? 0.25}
                      onChange={(e) => {
                        const ducking = { ...((data.ducking as AmbianceDuckingItemConfig) || {}), duckingRampDurationSec: Number(e.target.value) };
                        setData({ ...data, ducking });
                        setDirty(true);
                      }}
                    />
                    <span style={{ fontSize: '11px', opacity: 0.6 }}>sec</span>
                  </div>

                  <div className={styles.fieldRow}>
                    <label className={styles.fieldLabel}>Crossfade Duration</label>
                    <input
                      type="number"
                      step="0.1"
                      className={styles.fieldInput}
                      value={(data.ducking as AmbianceDuckingItemConfig)?.crossfadeDurationSec ?? 0.8}
                      onChange={(e) => {
                        const ducking = { ...((data.ducking as AmbianceDuckingItemConfig) || {}), crossfadeDurationSec: Number(e.target.value) };
                        setData({ ...data, ducking });
                        setDirty(true);
                      }}
                    />
                    <span style={{ fontSize: '11px', opacity: 0.6 }}>sec</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
