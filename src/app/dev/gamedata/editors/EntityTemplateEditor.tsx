'use client';
import { useState, useEffect } from 'react';
import { validateEcsRules, RUNTIME_INTENT_OR_TAG_KEYS } from '@/app/api/dev/gamedata/ecs-rules';
import type { FieldMeta } from '@/app/api/dev/gamedata/schema-introspect';
import { useGamedataStore } from '../store';
import { buildDefaultComponentData } from '../shared/default-values';
import { ComponentFieldGroup } from './shared/ComponentFieldGroup';
import styles from './editors.module.css';

interface Props {
  name: string;
  isNew?: boolean;
  cloneFrom?: string;
  onRefresh?: () => void;
}

interface ComponentSchemaItem {
  key: string;
  fields: FieldMeta[];
}

interface TemplateData {
  name: string;
  mixins?: string[];
  components?: Record<string, Record<string, unknown>>;
  overrides?: Record<string, Record<string, unknown>>;
  [key: string]: unknown;
}

export function EntityTemplateEditor({ name, isNew, cloneFrom, onRefresh }: Props) {
  const { setCloneSource, selectItem, clearSelection, setDirty } = useGamedataStore();
  const [templateData, setTemplateData] = useState<TemplateData | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [componentSchemas, setComponentSchemas] = useState<ComponentSchemaItem[]>([]);

  useEffect(() => {
    fetch('/api/dev/gamedata/components')
      .then((r) => r.json())
      .then((data) => setComponentSchemas(data.items || []))
      .catch(() => {});

    if (isNew && cloneFrom) {
      fetch(`/api/dev/gamedata/entities/${cloneFrom}`)
        .then((r) => r.json())
        .then((data) => {
          setTemplateData({ ...data, name: '' });
          setDirty(true);
        })
        .catch(() => setErrors(['Failed to load clone source']));
    } else if (!isNew && name) {
      fetch(`/api/dev/gamedata/entities/${name}`)
        .then((r) => r.json())
        .then((data) => {
          setTemplateData(data);
          setDirty(false);
        })
        .catch(() => setErrors(['Failed to load template']));
    } else {
      setTemplateData({ name: '', mixins: [], components: {} });
      setDirty(false);
    }
  }, [name, isNew, cloneFrom, setDirty]);

  const handleSave = async () => {
    if (!templateData) return;
    setSaveStatus('saving');
    setErrors([]);
    setWarnings([]);

    const comps = (templateData.components ?? {}) as Record<string, unknown>;
    const ecsResult = validateEcsRules(comps);
    if (!ecsResult.valid) {
      setErrors(ecsResult.errors.map((e) => e.message));
      setSaveStatus('error');
      return;
    }
    if (ecsResult.warnings.length > 0) {
      setWarnings(ecsResult.warnings.map((w) => `[WARN] ${w.message}`));
    }

    try {
      const method = isNew ? 'POST' : 'PUT';
      const url = isNew ? '/api/dev/gamedata/entities' : `/api/dev/gamedata/entities/${name}`;
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(templateData),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Save failed');
      }

      setSaveStatus('success');
      setDirty(false);
      onRefresh?.();

      if (isNew) {
        selectItem('entities', templateData.name);
      }
    } catch (err) {
      setErrors([err instanceof Error ? err.message : 'Failed to save template']);
      setSaveStatus('error');
    }
  };

  const handleClone = () => {
    if (!templateData) return;
    setCloneSource(templateData.name);
    selectItem('entities', '__new__');
  };

  const handleDelete = async () => {
    if (!name || isNew) return;
    const confirmed = window.confirm(`Are you sure you want to delete entity template '${name}'?`);
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/dev/gamedata/entities/${name}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to delete template');
      }
      setDirty(false);
      onRefresh?.();
      clearSelection();
    } catch (err) {
      setErrors([err instanceof Error ? err.message : 'Failed to delete template']);
    }
  };

  const handleAddComponent = (compKey: string) => {
    if (!templateData) return;
    const schema = componentSchemas.find((s) => s.key === compKey);
    const initialFields = schema ? buildDefaultComponentData(schema.fields) : {};
    setTemplateData({
      ...templateData,
      components: { ...(templateData.components ?? {}), [compKey]: initialFields },
    });
    setDirty(true);
  };

  const handleComponentFieldChange = (compKey: string, fieldKey: string, value: unknown) => {
    if (!templateData) return;
    const currentComp = templateData.components?.[compKey] ?? {};
    setTemplateData({
      ...templateData,
      components: {
        ...(templateData.components ?? {}),
        [compKey]: { ...currentComp, [fieldKey]: value },
      },
    });
    setDirty(true);
  };

  const handleRemoveComponent = (compKey: string) => {
    if (!templateData) return;
    const nextComponents = { ...(templateData.components ?? {}) };
    delete nextComponents[compKey];
    setTemplateData({ ...templateData, components: nextComponents });
    setDirty(true);
  };

  if (!templateData) return <div>Loading...</div>;

  const currentComponents = templateData.components ?? {};
  const attachedKeys = new Set(Object.keys(currentComponents));
  const availableSchemas = componentSchemas.filter(
    (s) => !attachedKeys.has(s.key) && !RUNTIME_INTENT_OR_TAG_KEYS.has(s.key),
  );

  return (
    <div className={styles.editor}>
      <div className={styles.editorHeader}>
        <h2 className={styles.editorTitle}>
          {isNew ? 'New Entity Template' : `Template: ${name}`}
        </h2>
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
      {warnings.length > 0 && (
        <div style={{ color: 'var(--c-warning, #ff6600)', marginBottom: '8px', fontSize: '12px' }}>
          {warnings.join(', ')}
        </div>
      )}

      <div className={styles.fieldRow}>
        <label className={styles.fieldLabel}>Name</label>
        <input
          className={styles.fieldInput}
          value={templateData.name}
          onChange={(e) => {
            setTemplateData({ ...templateData, name: e.target.value });
            setDirty(true);
          }}
          disabled={!isNew}
        />
      </div>

      {Object.entries(currentComponents).map(([key, vals]) => {
        const schema = componentSchemas.find((s) => s.key === key);
        return (
          <ComponentFieldGroup
            key={key}
            componentKey={key}
            fields={schema?.fields || []}
            values={(vals as Record<string, unknown>) || {}}
            onChange={handleComponentFieldChange}
            onRemove={handleRemoveComponent}
          />
        );
      })}

      <select
        className={styles.componentSelect}
        onChange={(e) => {
          if (e.target.value) handleAddComponent(e.target.value);
        }}
        value=""
      >
        <option value="" disabled>
          + Add Component ({availableSchemas.length} available)
        </option>
        {availableSchemas.map((s) => (
          <option key={s.key} value={s.key}>
            {s.key}
          </option>
        ))}
      </select>
    </div>
  );
}
