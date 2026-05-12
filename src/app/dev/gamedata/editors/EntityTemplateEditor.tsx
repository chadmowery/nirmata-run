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

export function EntityTemplateEditor({ name, isNew, cloneFrom, onRefresh }: Props) {
  const [templateData, setTemplateData] = useState<any>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [componentSchemas, setComponentSchemas] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/dev/gamedata/components')
      .then((r) => r.json())
      .then((data) => setComponentSchemas(data.items));

    if (isNew && cloneFrom) {
      fetch(`/api/dev/gamedata/entities/${cloneFrom}`)
        .then((r) => r.json())
        .then((data) => setTemplateData({ ...data, name: '' }))
        .catch(() => setErrors(['Failed to load clone source']));
    } else if (!isNew && name) {
      fetch(`/api/dev/gamedata/entities/${name}`)
        .then((r) => r.json())
        .then((data) => setTemplateData(data))
        .catch(() => setErrors(['Failed to load template']));
    } else {
      setTemplateData({ name: '', mixins: [], components: {} });
    }
  }, [name, isNew, cloneFrom]);

  const handleSave = async () => {
    setSaveStatus('saving');
    const ecsResult = validateEcsRules(templateData.components as Record<string, unknown>);
    if (!ecsResult.valid) {
      setErrors(ecsResult.errors.map((e) => e.message));
      setSaveStatus('error');
      return;
    }

    try {
      const method = isNew ? 'POST' : 'PUT';
      const url = isNew ? '/api/dev/gamedata/entities' : `/api/dev/gamedata/entities/${name}`;
      const res = await fetch(url, {
        method,
        body: JSON.stringify(templateData),
      });
      if (!res.ok) throw new Error('Save failed');
      setSaveStatus('success');
      onRefresh?.();
    } catch (e) {
      setErrors(['Failed to save template']);
      setSaveStatus('error');
    }
  };

  const handleAddComponent = (compKey: string) => {
    setTemplateData({
      ...templateData,
      components: { ...templateData.components, [compKey]: {} },
    });
  };

  const handleComponentFieldChange = (compKey: string, fieldKey: string, value: unknown) => {
    setTemplateData({
      ...templateData,
      components: {
        ...templateData.components,
        [compKey]: { ...templateData.components[compKey], [fieldKey]: value },
      },
    });
  };

  const handleRemoveComponent = (compKey: string) => {
    const nextComponents = { ...templateData.components };
    delete nextComponents[compKey];
    setTemplateData({ ...templateData, components: nextComponents });
  };

  if (!templateData) return <div>Loading...</div>;

  return (
    <div className={styles.editor}>
      <div className={styles.editorHeader}>
        <h2 className={styles.editorTitle}>{isNew ? 'New Entity Template' : `Template: ${name}`}</h2>
        <div className={styles.buttonRow}>
          <button className={styles.saveButton} onClick={handleSave} disabled={saveStatus === 'saving'}>
            {saveStatus === 'saving' ? 'SAVING...' : 'SAVE'}
          </button>
          {!isNew && (
            <button className={styles.cloneButton} onClick={() => console.log('Clone logic here')}>
              CLONE
            </button>
          )}
        </div>
      </div>

      {errors.length > 0 && (
        <div className={styles.errorMessage}>{errors.join(', ')}</div>
      )}

      <div className={styles.fieldRow}>
        <label className={styles.fieldLabel}>Name</label>
        <input
          className={styles.fieldInput}
          value={templateData.name}
          onChange={(e) => setTemplateData({ ...templateData, name: e.target.value })}
          disabled={!isNew}
        />
      </div>

      {Object.entries(templateData.components).map(([key, vals]) => {
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
