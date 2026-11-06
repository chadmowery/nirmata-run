'use client';
import { useState, useEffect } from 'react';
import type { ShellTemplate, ShellUpgrade } from '@/game/shells/server/types';
import { useGamedataStore } from '../store';
import styles from './editors.module.css';

interface Props {
  id: string;
  isNew?: boolean;
  cloneFrom?: string;
  onRefresh?: () => void;
}

export function ShellEditor({ id, isNew, cloneFrom, onRefresh }: Props) {
  const { setCloneSource, selectItem, clearSelection, setDirty } = useGamedataStore();
  const [shellData, setShellData] = useState<ShellTemplate | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');

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

  const handleSave = async () => {
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
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(shellData),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to save shell');
      }

      setSaveStatus('success');
      setDirty(false);
      onRefresh?.();

      if (isNew) {
        selectItem('shells', shellData.id);
      }
    } catch (err) {
      setErrors([err instanceof Error ? err.message : 'Save failed']);
      setSaveStatus('error');
    }
  };

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

  if (!shellData) return <div>Loading...</div>;

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
        <label className={styles.fieldLabel}>Sprite Key</label>
        <input
          className={styles.fieldInput}
          value={shellData.sprite || ''}
          placeholder="e.g. player_vanguard"
          onChange={(e) => {
            setShellData({ ...shellData, sprite: e.target.value });
            setDirty(true);
          }}
        />
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
