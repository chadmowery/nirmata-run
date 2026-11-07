'use client';
import { useState, useEffect, useCallback } from 'react';
import { useGamedataStore } from '../store';
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
        </div>
      )}
    </div>
  );
}
