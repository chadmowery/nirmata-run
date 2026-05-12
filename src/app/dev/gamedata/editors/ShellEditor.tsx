'use client';
import { useState, useEffect } from 'react';
import styles from './editors.module.css';

interface Props {
  id: string;
  isNew?: boolean;
  cloneFrom?: string;
  onRefresh?: () => void;
}

export function ShellEditor({ id, isNew, cloneFrom, onRefresh }: Props) {
  const [shellData, setShellData] = useState<any>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');

  useEffect(() => {
    if (isNew && cloneFrom) {
      fetch(`/api/dev/gamedata/shells/${cloneFrom}`)
        .then((r) => r.json())
        .then((data) => setShellData({ ...data, id: '' }))
        .catch(() => setErrors(['Failed to load clone source']));
    } else if (!isNew && id) {
      fetch(`/api/dev/gamedata/shells/${id}`)
        .then((r) => r.json())
        .then((data) => setShellData(data))
        .catch(() => setErrors(['Failed to load shell']));
    } else {
      setShellData({
        id: '', name: '',
        baseStats: { speed: 0, stability: 0, armor: 0, maxHealth: 0 },
        basePorts: { maxFirmware: 0, maxAugment: 0, maxSoftware: 0 },
        upgrades: []
      });
    }
  }, [id, isNew, cloneFrom]);

  const handleSave = async () => {
    setSaveStatus('saving');
    try {
      const method = isNew ? 'POST' : 'PUT';
      const url = isNew ? '/api/dev/gamedata/shells' : `/api/dev/gamedata/shells/${id}`;
      const res = await fetch(url, {
        method,
        body: JSON.stringify(shellData),
      });
      if (!res.ok) throw new Error('Save failed');
      setSaveStatus('success');
      onRefresh?.();
    } catch (e) {
      setErrors(['Failed to save shell']);
      setSaveStatus('error');
    }
  };

  if (!shellData) return <div>Loading...</div>;

  return (
    <div className={styles.editor}>
      <div className={styles.editorHeader}>
        <h2 className={styles.editorTitle}>{isNew ? 'New Shell' : `Shell: ${id}`}</h2>
        <div className={styles.buttonRow}>
          <button className={styles.saveButton} onClick={handleSave} disabled={saveStatus === 'saving'}>
            {saveStatus === 'saving' ? 'SAVING...' : 'SAVE'}
          </button>
        </div>
      </div>

      <div className={styles.fieldRow}>
        <label className={styles.fieldLabel}>ID</label>
        <input className={styles.fieldInput} value={shellData.id} onChange={(e) => setShellData({ ...shellData, id: e.target.value })} disabled={!isNew} />
      </div>
      <div className={styles.fieldRow}>
        <label className={styles.fieldLabel}>Name</label>
        <input className={styles.fieldInput} value={shellData.name} onChange={(e) => setShellData({ ...shellData, name: e.target.value })} />
      </div>

      <div className={styles.fieldGroup}>
        <h3 className={styles.fieldGroupTitle}>Stats</h3>
        {['speed', 'stability', 'armor', 'maxHealth'].map(stat => (
            <div key={stat} className={styles.fieldRow}>
                <label className={styles.fieldLabel}>{stat}</label>
                <input type="number" className={styles.fieldInput} value={shellData.baseStats[stat]} onChange={(e) => setShellData({...shellData, baseStats: {...shellData.baseStats, [stat]: Number(e.target.value)}})} />
            </div>
        ))}
      </div>

      <div className={styles.fieldGroup}>
        <h3 className={styles.fieldGroupTitle}>Ports</h3>
        {['maxFirmware', 'maxAugment', 'maxSoftware'].map(port => (
            <div key={port} className={styles.fieldRow}>
                <label className={styles.fieldLabel}>{port}</label>
                <input type="number" className={styles.fieldInput} value={shellData.basePorts[port]} onChange={(e) => setShellData({...shellData, basePorts: {...shellData.basePorts, [port]: Number(e.target.value)}})} />
            </div>
        ))}
      </div>
    </div>
  );
}
