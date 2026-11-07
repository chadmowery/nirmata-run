'use client';
import { useState, useEffect, useMemo } from 'react';
import { useGamedataStore } from '../store';
import styles from './editors.module.css';

interface Props {
  name: string;
  isNew?: boolean;
  cloneFrom?: string;
  onRefresh?: () => void;
}

interface TemplateEntry {
  name: string;
  weight: number;
  isPack?: boolean;
  packSize?: { min: number; max: number };
  maxPerFloor?: number;
  minDistanceFromPlayer?: number;
}

interface DepthBand {
  depthRange: { min: number; max: number };
  enemiesPerRoom: { min: number; max: number };
  templates: TemplateEntry[];
}

interface SpawnTableData {
  name: string;
  tables: DepthBand[];
}

export function SpawnTableEditor({ name, isNew, cloneFrom, onRefresh }: Props) {
  const { setCloneSource, selectItem, clearSelection, setDirty } = useGamedataStore();
  const [data, setData] = useState<SpawnTableData | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');

  useEffect(() => {
    if (isNew && cloneFrom) {
      fetch(`/api/dev/gamedata/spawn-tables/${cloneFrom}`)
        .then((r) => r.json())
        .then((d) => {
          setData({ ...d, name: '' });
          setDirty(true);
        })
        .catch(() => setErrors(['Failed to load clone source']));
    } else if (!isNew && name) {
      fetch(`/api/dev/gamedata/spawn-tables/${name}`)
        .then((r) => r.json())
        .then((d) => {
          setData({ name, tables: d.tables || [] });
          setDirty(false);
        })
        .catch(() => setErrors(['Failed to load table']));
    } else {
      setData({
        name: '',
        tables: [
          {
            depthRange: { min: 1, max: 4 },
            enemiesPerRoom: { min: 1, max: 2 },
            templates: [{ name: '', weight: 10 }],
          },
        ],
      });
      setDirty(false);
    }
  }, [name, isNew, cloneFrom, setDirty]);

  // Depth coverage validation
  const depthWarnings = useMemo(() => {
    if (!data?.tables?.length) return ['No depth bands defined.'];
    const warnings: string[] = [];
    for (let i = 0; i < data.tables.length; i++) {
      const b = data.tables[i];
      if (b.depthRange.min > b.depthRange.max) {
        warnings.push(`Band ${i + 1}: min depth (${b.depthRange.min}) exceeds max depth (${b.depthRange.max})`);
      }
      if (b.enemiesPerRoom.min > b.enemiesPerRoom.max) {
        warnings.push(`Band ${i + 1}: min enemies (${b.enemiesPerRoom.min}) exceeds max enemies (${b.enemiesPerRoom.max})`);
      }
      if (b.templates.length === 0) {
        warnings.push(`Band ${i + 1}: no enemy templates configured`);
      }
    }
    return warnings;
  }, [data]);

  const handleSave = async () => {
    if (!data) return;
    setSaveStatus('saving');
    setErrors([]);

    if (!data.name.trim()) {
      setErrors(['Table name is required']);
      setSaveStatus('error');
      return;
    }

    try {
      const method = isNew ? 'POST' : 'PUT';
      const url = isNew ? '/api/dev/gamedata/spawn-tables' : `/api/dev/gamedata/spawn-tables/${name}`;
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to save spawn table');
      }

      setSaveStatus('success');
      setDirty(false);
      onRefresh?.();

      if (isNew) {
        selectItem('spawnTables', data.name);
      }
    } catch (err) {
      setErrors([err instanceof Error ? err.message : 'Save failed']);
      setSaveStatus('error');
    }
  };

  const handleClone = () => {
    if (!data) return;
    setCloneSource(data.name || name);
    selectItem('spawnTables', '__new__');
  };

  const handleDelete = async () => {
    if (!name || isNew) return;
    const confirmed = window.confirm(`Are you sure you want to delete spawn table '${name}'?`);
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/dev/gamedata/spawn-tables/${name}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to delete table');
      }
      setDirty(false);
      onRefresh?.();
      clearSelection();
    } catch (err) {
      setErrors([err instanceof Error ? err.message : 'Failed to delete table']);
    }
  };

  const handleAddBand = () => {
    if (!data) return;
    const lastBand = data.tables[data.tables.length - 1];
    const nextMin = lastBand ? lastBand.depthRange.max + 1 : 1;
    const newBand: DepthBand = {
      depthRange: { min: nextMin, max: Math.min(15, nextMin + 4) },
      enemiesPerRoom: { min: 1, max: 3 },
      templates: [{ name: '', weight: 10 }],
    };
    setData({ ...data, tables: [...data.tables, newBand] });
    setDirty(true);
  };

  const handleRemoveBand = (idx: number) => {
    if (!data) return;
    const tables = data.tables.filter((_, i) => i !== idx);
    setData({ ...data, tables });
    setDirty(true);
  };

  const handleAddTemplate = (bandIdx: number) => {
    if (!data) return;
    const tables = [...data.tables];
    tables[bandIdx] = {
      ...tables[bandIdx],
      templates: [...tables[bandIdx].templates, { name: '', weight: 10 }],
    };
    setData({ ...data, tables });
    setDirty(true);
  };

  const handleRemoveTemplate = (bandIdx: number, tIdx: number) => {
    if (!data) return;
    const tables = [...data.tables];
    tables[bandIdx] = {
      ...tables[bandIdx],
      templates: tables[bandIdx].templates.filter((_, i) => i !== tIdx),
    };
    setData({ ...data, tables });
    setDirty(true);
  };

  if (!data) return <div>Loading...</div>;

  return (
    <div className={styles.editor}>
      <div className={styles.editorHeader}>
        <h2 className={styles.editorTitle}>{isNew ? 'New Spawn Table' : `Table: ${name}`}</h2>
        <div className={styles.buttonRow}>
          <button
            className={styles.saveButton}
            onClick={handleSave}
            disabled={saveStatus === 'saving'}
          >
            {saveStatus === 'saving' ? 'SAVING...' : 'SAVE'}
          </button>
          {!isNew && (
            <>
              <button className={styles.cloneButton} onClick={handleClone}>
                CLONE
              </button>
              <button className={styles.deleteButton} onClick={handleDelete}>
                DELETE
              </button>
            </>
          )}
        </div>
      </div>

      {errors.length > 0 && <div className={styles.errorMessage}>{errors.join(', ')}</div>}
      {depthWarnings.length > 0 && (
        <div style={{ color: 'var(--c-warning, #ff6600)', marginBottom: '12px', fontSize: '12px' }}>
          {depthWarnings.join(' | ')}
        </div>
      )}

      <div className={styles.fieldRow}>
        <label className={styles.fieldLabel}>Name</label>
        <input
          className={styles.fieldInput}
          value={data.name}
          onChange={(e) => {
            setData({ ...data, name: e.target.value });
            setDirty(true);
          }}
          disabled={!isNew}
        />
      </div>

      {data.tables.map((table: DepthBand, idx: number) => {
        const totalWeight = table.templates.reduce((sum, t) => sum + (t.weight || 0), 0);
        return (
          <div key={idx} className={styles.fieldGroup}>
            <div className={styles.fieldGroupHeader}>
              <span className={styles.fieldGroupTitle}>
                Depth Band {idx + 1} (F{table.depthRange.min}–F{table.depthRange.max})
              </span>
              <button className={styles.removeButton} onClick={() => handleRemoveBand(idx)}>
                REMOVE BAND
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
              <div className={styles.fieldRow}>
                <label className={styles.fieldLabel}>Floor Range</label>
                <input
                  type="number"
                  className={styles.fieldInput}
                  placeholder="Min"
                  value={table.depthRange.min}
                  onChange={(e) => {
                    const tables = [...data.tables];
                    tables[idx].depthRange.min = Number(e.target.value);
                    setData({ ...data, tables });
                    setDirty(true);
                  }}
                />
                <span style={{ padding: '0 4px', opacity: 0.6 }}>to</span>
                <input
                  type="number"
                  className={styles.fieldInput}
                  placeholder="Max"
                  value={table.depthRange.max}
                  onChange={(e) => {
                    const tables = [...data.tables];
                    tables[idx].depthRange.max = Number(e.target.value);
                    setData({ ...data, tables });
                    setDirty(true);
                  }}
                />
              </div>

              <div className={styles.fieldRow}>
                <label className={styles.fieldLabel}>Enemies/Room</label>
                <input
                  type="number"
                  className={styles.fieldInput}
                  placeholder="Min"
                  value={table.enemiesPerRoom.min}
                  onChange={(e) => {
                    const tables = [...data.tables];
                    tables[idx].enemiesPerRoom.min = Number(e.target.value);
                    setData({ ...data, tables });
                    setDirty(true);
                  }}
                />
                <span style={{ padding: '0 4px', opacity: 0.6 }}>to</span>
                <input
                  type="number"
                  className={styles.fieldInput}
                  placeholder="Max"
                  value={table.enemiesPerRoom.max}
                  onChange={(e) => {
                    const tables = [...data.tables];
                    tables[idx].enemiesPerRoom.max = Number(e.target.value);
                    setData({ ...data, tables });
                    setDirty(true);
                  }}
                />
              </div>
            </div>

            <div style={{ marginTop: '8px', marginBottom: '6px', fontSize: '11px', textTransform: 'uppercase', opacity: 0.7 }}>
              Weighted Enemies ({totalWeight} total weight)
            </div>

            {table.templates.map((tpl: TemplateEntry, tIdx: number) => {
              const spawnPct = totalWeight > 0 ? ((tpl.weight / totalWeight) * 100).toFixed(1) : '0';
              return (
                <div
                  key={tIdx}
                  style={{
                    background: 'var(--c-surface-elevated, #111722)',
                    padding: '8px',
                    borderRadius: '2px',
                    marginBottom: '6px',
                    border: '1px solid var(--c-border, #1c2638)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      className={styles.fieldInput}
                      placeholder="Enemy template ID"
                      value={tpl.name}
                      onChange={(e) => {
                        const tables = [...data.tables];
                        tables[idx].templates[tIdx].name = e.target.value;
                        setData({ ...data, tables });
                        setDirty(true);
                      }}
                      style={{ flex: 2 }}
                    />
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ fontSize: '11px', opacity: 0.7 }}>Wt:</span>
                      <input
                        type="number"
                        className={styles.fieldInput}
                        style={{ width: '60px' }}
                        value={tpl.weight}
                        onChange={(e) => {
                          const tables = [...data.tables];
                          tables[idx].templates[tIdx].weight = Number(e.target.value);
                          setData({ ...data, tables });
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
                        {spawnPct}%
                      </span>
                    </div>

                    <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={Boolean(tpl.isPack)}
                        onChange={(e) => {
                          const tables = [...data.tables];
                          tables[idx].templates[tIdx].isPack = e.target.checked;
                          if (e.target.checked && !tables[idx].templates[tIdx].packSize) {
                            tables[idx].templates[tIdx].packSize = { min: 2, max: 4 };
                          }
                          setData({ ...data, tables });
                          setDirty(true);
                        }}
                      />
                      Pack
                    </label>

                    <button
                      className={styles.removeButton}
                      style={{ padding: '2px 6px', fontSize: '10px' }}
                      onClick={() => handleRemoveTemplate(idx, tIdx)}
                    >
                      ✕
                    </button>
                  </div>

                  {tpl.isPack && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px', paddingLeft: '12px' }}>
                      <span style={{ fontSize: '11px', opacity: 0.7 }}>Pack Size:</span>
                      <input
                        type="number"
                        className={styles.fieldInput}
                        style={{ width: '50px' }}
                        value={tpl.packSize?.min ?? 2}
                        onChange={(e) => {
                          const tables = [...data.tables];
                          tables[idx].templates[tIdx].packSize = {
                            min: Number(e.target.value),
                            max: tables[idx].templates[tIdx].packSize?.max ?? 4,
                          };
                          setData({ ...data, tables });
                          setDirty(true);
                        }}
                      />
                      <span style={{ fontSize: '11px', opacity: 0.6 }}>to</span>
                      <input
                        type="number"
                        className={styles.fieldInput}
                        style={{ width: '50px' }}
                        value={tpl.packSize?.max ?? 4}
                        onChange={(e) => {
                          const tables = [...data.tables];
                          tables[idx].templates[tIdx].packSize = {
                            min: tables[idx].templates[tIdx].packSize?.min ?? 2,
                            max: Number(e.target.value),
                          };
                          setData({ ...data, tables });
                          setDirty(true);
                        }}
                      />
                    </div>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '6px', paddingLeft: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ fontSize: '11px', opacity: 0.7 }}>Max/Floor:</span>
                      <input
                        type="number"
                        className={styles.fieldInput}
                        style={{ width: '50px' }}
                        placeholder="∞"
                        value={tpl.maxPerFloor ?? ''}
                        onChange={(e) => {
                          const tables = [...data.tables];
                          const val = e.target.value ? Number(e.target.value) : undefined;
                          tables[idx].templates[tIdx].maxPerFloor = val;
                          setData({ ...data, tables });
                          setDirty(true);
                        }}
                      />
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ fontSize: '11px', opacity: 0.7 }}>Min Dist:</span>
                      <input
                        type="number"
                        className={styles.fieldInput}
                        style={{ width: '50px' }}
                        placeholder="0"
                        value={tpl.minDistanceFromPlayer ?? ''}
                        onChange={(e) => {
                          const tables = [...data.tables];
                          const val = e.target.value ? Number(e.target.value) : undefined;
                          tables[idx].templates[tIdx].minDistanceFromPlayer = val;
                          setData({ ...data, tables });
                          setDirty(true);
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}

            <button
              className={styles.addComponentButton}
              style={{ marginTop: '6px' }}
              onClick={() => handleAddTemplate(idx)}
            >
              + Add Enemy Row
            </button>
          </div>
        );
      })}

      <button className={styles.addComponentButton} onClick={handleAddBand}>
        + Add Depth Band
      </button>
    </div>
  );
}
