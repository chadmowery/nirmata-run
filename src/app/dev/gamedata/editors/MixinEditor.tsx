'use client';
import { useState, useEffect } from 'react';
import { validateEcsRules } from '@/app/api/dev/gamedata/ecs-rules';
import { ComponentFieldGroup } from './shared/ComponentFieldGroup';
import styles from './editors.module.css';

interface Props {
  name: string;
  isNew?: boolean;
  cloneFrom?: string;
  onRefresh?: () => void;
}

export function MixinEditor({ name, isNew, cloneFrom, onRefresh }: Props) {
  const [mixinData, setMixinData] = useState<any>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [componentSchemas, setComponentSchemas] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/dev/gamedata/components')
      .then((r) => r.json())
      .then((data) => setComponentSchemas(data.items));

    if (isNew && cloneFrom) {
      fetch(`/api/dev/gamedata/mixins/${cloneFrom}`)
        .then((r) => r.json())
        .then((data) => setMixinData({ ...data, name: '' }))
        .catch(() => setErrors(['Failed to load clone source']));
    } else if (!isNew && name) {
      fetch(`/api/dev/gamedata/mixins/${name}`)
        .then((r) => r.json())
        .then((data) => setMixinData(data))
        .catch(() => setErrors(['Failed to load mixin']));
    } else {
      setMixinData({ name: '', components: {} });
    }
  }, [name, isNew, cloneFrom]);

  const handleSave = async () => {
    setSaveStatus('saving');
    const ecsResult = validateEcsRules(mixinData.components as Record<string, unknown>);
    if (!ecsResult.valid) {
      setErrors(ecsResult.errors.map((e) => e.message));
      setSaveStatus('error');
      return;
    }

    try {
      const method = isNew ? 'POST' : 'PUT';
      const url = isNew ? '/api/dev/gamedata/mixins' : `/api/dev/gamedata/mixins/${name}`;
      const res = await fetch(url, {
        method,
        body: JSON.stringify(mixinData),
      });
      if (!res.ok) throw new Error('Save failed');
      setSaveStatus('success');
      onRefresh?.();
    } catch (e) {
      setErrors(['Failed to save mixin']);
      setSaveStatus('error');
    }
  };

  const handleAddComponent = (compKey: string) => {
    setMixinData({
      ...mixinData,
      components: { ...mixinData.components, [compKey]: {} },
    });
  };

  const handleComponentFieldChange = (compKey: string, fieldKey: string, value: unknown) => {
    setMixinData({
      ...mixinData,
      components: {
        ...mixinData.components,
        [compKey]: { ...mixinData.components[compKey], [fieldKey]: value },
      },
    });
  };

  const handleRemoveComponent = (compKey: string) => {
    const nextComponents = { ...mixinData.components };
    delete nextComponents[compKey];
    setMixinData({ ...mixinData, components: nextComponents });
  };

  if (!mixinData) return <div>Loading...</div>;

  return (
    <div className={styles.editor}>
      <div className={styles.editorHeader}>
        <h2 className={styles.editorTitle}>{isNew ? 'New Mixin' : `Mixin: ${name}`}</h2>
        <div className={styles.buttonRow}>
          <button className={styles.saveButton} onClick={handleSave} disabled={saveStatus === 'saving'}>
            {saveStatus === 'saving' ? 'SAVING...' : 'SAVE'}
          </button>
        </div>
      </div>

      {errors.length > 0 && (
        <div className={styles.errorMessage}>{errors.join(', ')}</div>
      )}

      <div className={styles.fieldRow}>
        <label className={styles.fieldLabel}>Name</label>
        <input
          className={styles.fieldInput}
          value={mixinData.name}
          onChange={(e) => setMixinData({ ...mixinData, name: e.target.value })}
          disabled={!isNew}
        />
      </div>

      {Object.entries(mixinData.components).map(([key, vals]) => {
        const schema = componentSchemas.find((s) => s.key === key);
        return (
          <ComponentFieldGroup
            key={key}
            componentKey={key}
            fields={schema?.fields || []}
            values={vals as Record<string, unknown>}
            onChange={handleComponentFieldChange}
            onRemove={handleRemoveComponent}
          />
        );
      })}

      <select
        className={styles.componentSelect}
        onChange={(e) => handleAddComponent(e.target.value)}
        value=""
      >
        <option value="" disabled>+ Add Component</option>
        {componentSchemas.map((s) => (
          <option key={s.key} value={s.key}>{s.key}</option>
        ))}
      </select>
    </div>
  );
}
