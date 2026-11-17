'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import type { ShellTemplate, ShellUpgrade } from '@/game/shells/server/types';
import {
  CARDINAL_DIRECTIONS,
  type CardinalDirectionSuffix,
  hasConfiguredDirectionalSprites,
  normalizeCardinalDirection,
  normalizeDirectionalSprites,
} from '@shared/utils/shell-sprite-util';
import { useGamedataStore } from '../store';
import { SpritePicker } from '../shared/SpritePicker';
import { LightSourceSubEditor, type LightSourceSubEditorValues } from './subeditors/LightSourceSubEditor';
import {
  postHotloadCommit,
  postHotloadPreview,
  postHotloadRevert,
} from '@dev-tool/hotload/studio-sync';
import styles from './editors.module.css';

const DIRECTION_ROWS: readonly { key: CardinalDirectionSuffix; label: string }[] = [
  { key: 'north', label: 'North (↑)' },
  { key: 'east', label: 'East (→)' },
  { key: 'south', label: 'South (↓)' },
  { key: 'west', label: 'West (←)' },
];

interface Props {
  id: string;
  isNew?: boolean;
  cloneFrom?: string;
  onRefresh?: () => void;
}

export function ShellEditor({ id, isNew, cloneFrom, onRefresh }: Props) {
  const {
    setCloneSource,
    selectItem,
    clearSelection,
    setDirty,
    setActiveEffectiveData,
    setActiveValidationStatus,
    liveSyncEnabled,
    isDirty,
  } = useGamedataStore();
  const [shellData, setShellData] = useState<ShellTemplate | null>(null);
  const baselineRef = useRef<ShellTemplate | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');

  // Sync to telemetry store & LIVE_SYNC presentation preview
  useEffect(() => {
    if (shellData) {
      setActiveEffectiveData(shellData);
      const valid = Boolean(shellData.id && shellData.name);
      setActiveValidationStatus({
        zodValid: valid,
      });
      if (isDirty && liveSyncEnabled && !isNew && id) {
        postHotloadPreview('shell', id, shellData, 16);
      }
    }
  }, [shellData, isDirty, liveSyncEnabled, isNew, id, setActiveEffectiveData, setActiveValidationStatus]);

  useEffect(() => {
    const onRevert = () => {
      if (!baselineRef.current || isNew || !id) return;
      const restored = structuredClone(baselineRef.current);
      setShellData(restored);
      setDirty(false);
      postHotloadRevert('shell', id, restored);
    };
    window.addEventListener('gamedata-revert', onRevert);
    return () => window.removeEventListener('gamedata-revert', onRevert);
  }, [isNew, id, setDirty]);

  useEffect(() => {
    if (isNew && cloneFrom) {
      fetch(`/api/dev/gamedata/shells/${cloneFrom}`)
        .then((r) => r.json())
        .then((data: ShellTemplate) => {
          setShellData({ ...data, id: '' });
          setDirty(true);
        })
        .catch(() => setErrors(['Failed to load clone source']));
    } else if (!isNew && id) {
      fetch(`/api/dev/gamedata/shells/${id}`)
        .then((r) => r.json())
        .then((data: ShellTemplate) => {
          setShellData(data);
          baselineRef.current = structuredClone(data);
          setDirty(false);
        })
        .catch(() => setErrors(['Failed to load shell']));
    } else {
      setShellData({
        id: '',
        name: '',
        sprite: 'player_vanguard',
        baseStats: { speed: 100, stability: 5, armor: 1, maxHealth: 20 },
        basePorts: { maxFirmware: 1, maxAugment: 1, maxSoftware: 2 },
        upgrades: [],
        starterLoadout: [],
      });
      setDirty(false);
    }
  }, [id, isNew, cloneFrom, setDirty]);

  const handleSave = useCallback(async () => {
    if (!shellData) return;
    setSaveStatus('saving');
    setErrors([]);

    if (!shellData.id.trim() || !shellData.name.trim()) {
      setErrors(['Shell ID and Name are required']);
      setSaveStatus('error');
      return;
    }

    try {
      const method = isNew ? 'POST' : 'PUT';
      const url = isNew ? '/api/dev/gamedata/shells' : `/api/dev/gamedata/shells/${id}`;
      const normalizedDirectional = normalizeDirectionalSprites(shellData.directionalSprites);
      const payload: ShellTemplate = {
        ...shellData,
        directionalSprites: normalizedDirectional,
        defaultDirection: normalizedDirectional ? (shellData.defaultDirection ?? 'south') : undefined,
      };
      if (!normalizedDirectional) {
        delete payload.directionalSprites;
        delete payload.defaultDirection;
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to save shell');
      }

      const resData = await res.json().catch(() => ({}));
      setShellData(payload);
      baselineRef.current = structuredClone(payload);
      setSaveStatus('success');
      setDirty(false);
      postHotloadCommit('shell', payload.id, payload, resData.sessionPatches, resData.envelope?.id);
      onRefresh?.();

      if (isNew) {
        selectItem('shells', shellData.id);
      }
    } catch (err) {
      setErrors([err instanceof Error ? err.message : 'Save failed']);
      setSaveStatus('error');
    }
  }, [shellData, isNew, id, setDirty, onRefresh, selectItem]);

  useEffect(() => {
    const onSaveKey = () => {
      handleSave();
    };
    window.addEventListener('gamedata-save', onSaveKey);
    return () => window.removeEventListener('gamedata-save', onSaveKey);
  }, [handleSave]);

  const handleClone = () => {
    if (!shellData) return;
    setCloneSource(shellData.id || id);
    selectItem('shells', '__new__');
  };

  const handleDelete = async () => {
    if (!id || isNew) return;
    const confirmed = window.confirm(`Are you sure you want to delete shell '${id}'?`);
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/dev/gamedata/shells/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to delete shell');
      }
      setDirty(false);
      onRefresh?.();
      clearSelection();
    } catch (err) {
      setErrors([err instanceof Error ? err.message : 'Failed to delete shell']);
    }
  };

  const handleAddStarterItem = () => {
    if (!shellData) return;
    setShellData({
      ...shellData,
      starterLoadout: [...(shellData.starterLoadout || []), ''],
    });
    setDirty(true);
  };

  const handleRemoveStarterItem = (index: number) => {
    if (!shellData) return;
    setShellData({
      ...shellData,
      starterLoadout: (shellData.starterLoadout || []).filter((_, i) => i !== index),
    });
    setDirty(true);
  };

  const handleAddUpgrade = () => {
    if (!shellData) return;
    const nextLevel = (shellData.upgrades?.length || 0) + 1;
    const newUpgrade: ShellUpgrade = {
      level: nextLevel,
      statBonuses: { maxHealth: 2, armor: 1 },
      portBonuses: {},
    };
    setShellData({
      ...shellData,
      upgrades: [...(shellData.upgrades || []), newUpgrade],
    });
    setDirty(true);
  };

  const handleRemoveUpgrade = (index: number) => {
    if (!shellData) return;
    setShellData({
      ...shellData,
      upgrades: (shellData.upgrades || []).filter((_, i) => i !== index),
    });
    setDirty(true);
  };

  const handleDirectionalSpriteChange = (dir: CardinalDirectionSuffix, val: string) => {
    if (!shellData) return;
    const nextDefault = normalizeCardinalDirection(shellData.defaultDirection) ?? 'south';
    const nextDirectional = {
      ...(shellData.directionalSprites ?? {}),
      [dir]: val,
    };
    const nextData: ShellTemplate = {
      ...shellData,
      directionalSprites: nextDirectional,
      defaultDirection: hasConfiguredDirectionalSprites(nextDirectional) ? nextDefault : shellData.defaultDirection,
    };
    if (dir === nextDefault && val.trim()) {
      nextData.sprite = val.trim();
    }
    setShellData(nextData);
    setDirty(true);
  };

  const handleDefaultDirectionChange = (nextDefault: CardinalDirectionSuffix) => {
    if (!shellData) return;
    const syncedSprite = shellData.directionalSprites?.[nextDefault]?.trim();
    setShellData({
      ...shellData,
      defaultDirection: nextDefault,
      ...(syncedSprite ? { sprite: syncedSprite } : {}),
    });
    setDirty(true);
  };

  const handleAutoFillDirectional = () => {
    if (!shellData) return;
    const prefix = (shellData.id || id || 'shell').trim();
    const defaultDir = normalizeCardinalDirection(shellData.defaultDirection) ?? 'south';
    const autoSprites = {
      north: `${prefix}-north`,
      east: `${prefix}-east`,
      south: `${prefix}-south`,
      west: `${prefix}-west`,
    };
    setShellData({
      ...shellData,
      defaultDirection: defaultDir,
      directionalSprites: autoSprites,
      sprite: autoSprites[defaultDir],
    });
    setDirty(true);
  };

  const handleClearDirectional = () => {
    if (!shellData) return;
    const rest = { ...shellData };
    delete rest.directionalSprites;
    delete rest.defaultDirection;
    setShellData(rest);
    setDirty(true);
  };

  if (!shellData) return <div>Loading...</div>;

  const hasDirections =
    hasConfiguredDirectionalSprites(shellData.directionalSprites) ||
    Boolean(shellData.defaultDirection);
  const activeDefaultDirection: CardinalDirectionSuffix =
    normalizeCardinalDirection(shellData.defaultDirection) ?? 'south';

  return (
    <div className={styles.editor}>
      <div className={styles.editorHeader}>
        <h2 className={styles.editorTitle}>{isNew ? 'New Shell' : `Shell: ${id}`}</h2>
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

      <div className={styles.fieldRow}>
        <label className={styles.fieldLabel}>ID (Slug)</label>
        <input
          className={styles.fieldInput}
          value={shellData.id}
          onChange={(e) => {
            setShellData({ ...shellData, id: e.target.value });
            setDirty(true);
          }}
          disabled={!isNew}
        />
      </div>

      <div className={styles.fieldRow}>
        <label className={styles.fieldLabel}>Display Name</label>
        <input
          className={styles.fieldInput}
          value={shellData.name}
          onChange={(e) => {
            setShellData({ ...shellData, name: e.target.value });
            setDirty(true);
          }}
        />
      </div>

      <div className={styles.fieldRow}>
        <label className={styles.fieldLabel}>Base Sprite</label>
        <div style={{ flex: 1 }}>
          <SpritePicker
            value={shellData.sprite || ''}
            onChange={(val) => {
              setShellData({ ...shellData, sprite: val });
              setDirty(true);
            }}
          />
        </div>
      </div>

      {/* Cardinal Direction Sprites */}
      <div className={styles.fieldGroup}>
        <div className={styles.fieldGroupHeader}>
          <span className={styles.fieldGroupTitle}>Cardinal Direction Sprites (N / E / S / W)</span>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <button
              type="button"
              className={styles.addComponentButton}
              style={{ marginTop: 0 }}
              onClick={handleAutoFillDirectional}
              title="Populate <shell-id>-{north,east,south,west} sprite keys"
            >
              Auto-Fill {shellData.id || id || 'shell'}-&#123;dir&#125;
            </button>
            {hasDirections && (
              <button
                type="button"
                className={styles.removeButton}
                onClick={handleClearDirectional}
              >
                CLEAR
              </button>
            )}
          </div>
        </div>

        <div className={styles.fieldRow}>
          <label className={styles.fieldLabel} htmlFor="shell-default-direction">
            Default Facing
          </label>
          <select
            id="shell-default-direction"
            className={styles.fieldSelect}
            value={activeDefaultDirection}
            onChange={(e) =>
              handleDefaultDirectionChange(e.target.value as CardinalDirectionSuffix)
            }
          >
            {CARDINAL_DIRECTIONS.map((dir) => (
              <option key={dir} value={dir}>
                {dir.toUpperCase()}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '8px' }}>
          {DIRECTION_ROWS.map((dir) => {
            const isDefault = activeDefaultDirection === dir.key;
            return (
              <div key={dir.key} className={styles.fieldRow} style={{ alignItems: 'flex-start' }}>
                <label className={styles.fieldLabel} style={{ paddingTop: '10px' }}>
                  {dir.label}
                  {isDefault && (
                    <span
                      style={{
                        marginLeft: '6px',
                        fontSize: '9px',
                        color: 'var(--c-accent-secondary, #00f0ff)',
                      }}
                    >
                      [DEFAULT]
                    </span>
                  )}
                </label>
                <div style={{ flex: 1 }}>
                  <SpritePicker
                    value={shellData.directionalSprites?.[dir.key] || ''}
                    onChange={(val) => handleDirectionalSpriteChange(dir.key, val)}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Base Stats */}
      <div className={styles.fieldGroup}>
        <h3 className={styles.fieldGroupTitle}>Base Stats</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          {(['speed', 'stability', 'armor', 'maxHealth'] as const).map((stat) => (
            <div key={stat} className={styles.fieldRow}>
              <label className={styles.fieldLabel} style={{ textTransform: 'capitalize' }}>{stat}</label>
              <input
                type="number"
                className={styles.fieldInput}
                value={shellData.baseStats[stat]}
                onChange={(e) => {
                  setShellData({
                    ...shellData,
                    baseStats: { ...shellData.baseStats, [stat]: Number(e.target.value) },
                  });
                  setDirty(true);
                }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Base Ports */}
      <div className={styles.fieldGroup}>
        <h3 className={styles.fieldGroupTitle}>Base Ports</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
          {(['maxFirmware', 'maxAugment', 'maxSoftware'] as const).map((port) => (
            <div key={port} className={styles.fieldRow}>
              <label className={styles.fieldLabel} style={{ textTransform: 'capitalize' }}>
                {port.replace('max', '')}
              </label>
              <input
                type="number"
                className={styles.fieldInput}
                value={shellData.basePorts[port]}
                onChange={(e) => {
                  setShellData({
                    ...shellData,
                    basePorts: { ...shellData.basePorts, [port]: Number(e.target.value) },
                  });
                  setDirty(true);
                }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Light Source Emitter Override */}
      <div className={styles.fieldGroup}>
        <div className={styles.fieldGroupHeader}>
          <span className={styles.fieldGroupTitle}>Light Source Emitter (Optional)</span>
          {shellData.lightSource ? (
            <button
              type="button"
              className={styles.removeButton}
              onClick={() => {
                const rest = { ...shellData };
                delete rest.lightSource;
                setShellData(rest);
                setDirty(true);
              }}
            >
              REMOVE
            </button>
          ) : (
            <button
              type="button"
              className={styles.addComponentButton}
              onClick={() => {
                setShellData({
                  ...shellData,
                  lightSource: {
                    enabled: true,
                    color: '#00f0ff',
                    intensity: 1.5,
                    radius: 224,
                    height: 20,
                    falloff: 1.35,
                    castsShadows: true,
                    offsetX: 0,
                    offsetY: 0,
                    animation: { type: 'STATIC', speed: 2.0, amplitude: 0.2 },
                  },
                });
                setDirty(true);
              }}
            >
              + Attach Light Source
            </button>
          )}
        </div>
        {shellData.lightSource && (
          <LightSourceSubEditor
            values={shellData.lightSource as LightSourceSubEditorValues}
            onFieldChange={(fieldKey, val) => {
              const current = shellData.lightSource ?? {
                enabled: true,
                color: '#00f0ff',
                intensity: 1.5,
                radius: 224,
                height: 20,
                falloff: 1.35,
                castsShadows: true,
                offsetX: 0,
                offsetY: 0,
                animation: { type: 'STATIC', speed: 2.0, amplitude: 0.2 },
              };
              setShellData({
                ...shellData,
                lightSource: {
                  ...current,
                  [fieldKey]: val,
                },
              });
              setDirty(true);
            }}
          />
        )}
      </div>

      {/* Starter Loadout */}
      <div className={styles.fieldGroup}>
        <div className={styles.fieldGroupHeader}>
          <span className={styles.fieldGroupTitle}>Starter Loadout</span>
          <button className={styles.addComponentButton} onClick={handleAddStarterItem}>
            + Add Starter Item
          </button>
        </div>
        {(shellData.starterLoadout || []).map((item, idx) => (
          <div key={idx} style={{ display: 'flex', gap: '8px', marginBottom: '6px' }}>
            <input
              className={styles.fieldInput}
              placeholder="Template ID (e.g. basic-strike)"
              value={item}
              onChange={(e) => {
                const loadout = [...(shellData.starterLoadout || [])];
                loadout[idx] = e.target.value;
                setShellData({ ...shellData, starterLoadout: loadout });
                setDirty(true);
              }}
              style={{ flex: 1 }}
            />
            <button
              className={styles.removeButton}
              onClick={() => handleRemoveStarterItem(idx)}
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      {/* Upgrades */}
      <div className={styles.fieldGroup}>
        <div className={styles.fieldGroupHeader}>
          <span className={styles.fieldGroupTitle}>Upgrades ({(shellData.upgrades || []).length})</span>
          <button className={styles.addComponentButton} onClick={handleAddUpgrade}>
            + Add Upgrade Level
          </button>
        </div>
        {(shellData.upgrades || []).map((upg, idx) => (
          <div
            key={idx}
            style={{
              background: 'var(--c-surface-elevated, #111722)',
              padding: '8px',
              borderRadius: '2px',
              marginBottom: '8px',
              border: '1px solid var(--c-border, #1c2638)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span style={{ fontSize: '12px', fontWeight: 'bold' }}>Level {upg.level}</span>
              <button
                className={styles.removeButton}
                onClick={() => handleRemoveUpgrade(idx)}
              >
                REMOVE
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', fontSize: '11px' }}>
              <div>
                <span>+HP: </span>
                <input
                  type="number"
                  className={styles.fieldInput}
                  style={{ width: '45px' }}
                  value={upg.statBonuses?.maxHealth ?? 0}
                  onChange={(e) => {
                    const upgs = [...(shellData.upgrades || [])];
                    upgs[idx] = {
                      ...upgs[idx],
                      statBonuses: { ...upgs[idx].statBonuses, maxHealth: Number(e.target.value) },
                    };
                    setShellData({ ...shellData, upgrades: upgs });
                    setDirty(true);
                  }}
                />
              </div>
              <div>
                <span>+Armor: </span>
                <input
                  type="number"
                  className={styles.fieldInput}
                  style={{ width: '45px' }}
                  value={upg.statBonuses?.armor ?? 0}
                  onChange={(e) => {
                    const upgs = [...(shellData.upgrades || [])];
                    upgs[idx] = {
                      ...upgs[idx],
                      statBonuses: { ...upgs[idx].statBonuses, armor: Number(e.target.value) },
                    };
                    setShellData({ ...shellData, upgrades: upgs });
                    setDirty(true);
                  }}
                />
              </div>
              <div>
                <span>+Speed: </span>
                <input
                  type="number"
                  className={styles.fieldInput}
                  style={{ width: '45px' }}
                  value={upg.statBonuses?.speed ?? 0}
                  onChange={(e) => {
                    const upgs = [...(shellData.upgrades || [])];
                    upgs[idx] = {
                      ...upgs[idx],
                      statBonuses: { ...upgs[idx].statBonuses, speed: Number(e.target.value) },
                    };
                    setShellData({ ...shellData, upgrades: upgs });
                    setDirty(true);
                  }}
                />
              </div>
              <div>
                <span>+Softw: </span>
                <input
                  type="number"
                  className={styles.fieldInput}
                  style={{ width: '45px' }}
                  value={upg.portBonuses?.maxSoftware ?? 0}
                  onChange={(e) => {
                    const upgs = [...(shellData.upgrades || [])];
                    upgs[idx] = {
                      ...upgs[idx],
                      portBonuses: { ...upgs[idx].portBonuses, maxSoftware: Number(e.target.value) },
                    };
                    setShellData({ ...shellData, upgrades: upgs });
                    setDirty(true);
                  }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
