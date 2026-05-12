'use client';
import { useState, useEffect } from 'react';
import styles from './editors.module.css';

interface Props {
  name: string;
  isNew?: boolean;
  cloneFrom?: string;
  onRefresh?: () => void;
}

export function SpawnTableEditor({ name, isNew, cloneFrom, onRefresh }: Props) {
  const [data, setData] = useState<any>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');

  useEffect(() => {
    if (isNew && cloneFrom) {
      fetch(`/api/dev/gamedata/spawn-tables/${cloneFrom}`)
        .then((r) => r.json())
        .then((d) => setData({ ...d, name: '' }))
        .catch(() => console.error('Failed to load clone source'));
    } else if (!isNew && name) {
      fetch(`/api/dev/gamedata/spawn-tables/${name}`)
        .then((r) => r.json())
        .then((d) => setData(d))
        .catch(() => console.error('Failed to load table'));
    } else {
      setData({ name: '', tables: [] });
    }
  }, [name, isNew, cloneFrom]);

  const handleSave = async () => {
    setSaveStatus('saving');
    const method = isNew ? 'POST' : 'PUT';
    const url = isNew ? '/api/dev/gamedata/spawn-tables' : `/api/dev/gamedata/spawn-tables/${name}`;
    await fetch(url, { method, body: JSON.stringify(data) });
    setSaveStatus('success');
    onRefresh?.();
  };

  if (!data) return <div>Loading...</div>;

  return (
    <div className={styles.editor}>
      <div className={styles.editorHeader}>
        <h2 className={styles.editorTitle}>{isNew ? 'New Spawn Table' : `Table: ${name}`}</h2>
        <button className={styles.saveButton} onClick={handleSave}>SAVE</button>
      </div>

      <div className={styles.fieldRow}>
        <label className={styles.fieldLabel}>Name</label>
        <input className={styles.fieldInput} value={data.name} onChange={(e) => setData({ ...data, name: e.target.value })} disabled={!isNew} />
      </div>

      {data.tables.map((table: any, idx: number) => (
        <div key={idx} className={styles.fieldGroup}>
          <h3 className={styles.fieldGroupTitle}>Depth Band {idx}</h3>
          <div className={styles.fieldRow}>
            <label className={styles.fieldLabel}>Min/Max Depth</label>
            <input type="number" className={styles.fieldInput} value={table.depthRange.min} onChange={(e) => {
                const tables = [...data.tables];
                tables[idx].depthRange.min = Number(e.target.value);
                setData({...data, tables});
            }}/>
            <input type="number" className={styles.fieldInput} value={table.depthRange.max} onChange={(e) => {
                const tables = [...data.tables];
                tables[idx].depthRange.max = Number(e.target.value);
                setData({...data, tables});
            }}/>
          </div>
          {table.templates.map((tpl: any, tIdx: number) => (
              <div key={tIdx} className={styles.fieldRow}>
                  <input className={styles.fieldInput} value={tpl.name} onChange={(e) => {
                      const tables = [...data.tables];
                      tables[idx].templates[tIdx].name = e.target.value;
                      setData({...data, tables});
                  }}/>
                  <input type="number" className={styles.fieldInput} value={tpl.weight} onChange={(e) => {
                      const tables = [...data.tables];
                      tables[idx].templates[tIdx].weight = Number(e.target.value);
                      setData({...data, tables});
                  }}/>
              </div>
          ))}
        </div>
      ))}
      <button className={styles.addComponentButton} onClick={() => setData({...data, tables: [...data.tables, {depthRange: {min:0, max:1}, templates: []}]})}>+ Add Depth Band</button>
    </div>
  );
}
