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

interface MixinData {
  name: string;
  components?: Record<string, Record<string, unknown>>;
  [key: string]: unknown;
}

export function MixinEditor({ name, isNew, cloneFrom, onRefresh }: Props) {
  const { setCloneSource, selectItem, clearSelection, setDirty } = useGamedataStore();
  const [mixinData, setMixinData] = useState<MixinData | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [componentSchemas, setComponentSchemas] = useState<ComponentSchemaItem[]>([]);

  useEffect(() => {
    fetch('/api/dev/gamedata/components')
      .then((r) => r.json())
      .then((data) => setComponentSchemas(data.items || []))
      .catch(() => {});

    if (isNew && cloneFrom) {
      fetch(`/api/dev/gamedata/mixins/${cloneFrom}`)
        .then((r) => r.json())
        .then((data) => {
          setMixinData({ ...data, name: '' });
          setDirty(true);
        })
        .catch(() => setErrors(['Failed to load clone source']));
    } else if (!isNew && name) {
      fetch(`/api/dev/gamedata/mixins/${name}`)
        .then((r) => r.json())
        .then((data) => {
          setMixinData(data);
          setDirty(false);
        })
        .catch(() => setErrors(['Failed to load mixin']));
    } else {
      setMixinData({ name: '', components: {} });
      setDirty(false);
    }
  }, [name, isNew, cloneFrom, setDirty]);

  const handleSave = async () => {
    if (!mixinData) return;
    setSaveStatus('saving');
    setErrors([]);

    const comps = (mixinData.components ?? {}) as Record<string, unknown>;
    const ecsResult = validateEcsRules(comps);
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mixinData),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Save failed');
      }

      setSaveStatus('success');
      setDirty(false);
      onRefresh?.();

      if (isNew) {
        selectItem('mixins', mixinData.name);
      }
    } catch (err) {
      setErrors([err instanceof Error ? err.message : 'Failed to save mixin']);
      setSaveStatus('error');
    }
  };

  const handleClone = () => {
    if (!mixinData) return;
    setCloneSource(mixinData.name);
    selectItem('mixins', '__new__');
  };

  const handleDelete = async () => {
    if (!name || isNew) return;
    const confirmed = window.confirm(`Are you sure you want to delete mixin '${name}'?`);
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/dev/gamedata/mixins/${name}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to delete mixin');
      }
      setDirty(false);
      onRefresh?.();
      clearSelection();
    } catch (err) {
      setErrors([err instanceof Error ? err.message : 'Failed to delete mixin']);
    }
  };

  const handleAddComponent = (compKey: string) => {
    if (!mixinData) return;
    const schema = componentSchemas.find((s) => s.key === compKey);
    const initialFields = schema ? buildDefaultComponentData(schema.fields) : {};
    setMixinData({
      ...mixinData,
      components: { ...(mixinData.components ?? {}), [compKey]: initialFields },
    });
    setDirty(true);
  };

  const handleComponentFieldChange = (compKey: string, fieldKey: string, value: unknown) => {
    if (!mixinData) return;
    const currentComp = mixinData.components?.[compKey] ?? {};
    setMixinData({
      ...mixinData,
      components: {
        ...(mixinData.components ?? {}),
        [compKey]: { ...currentComp, [fieldKey]: value },
      },
    });
    setDirty(true);
  };

  const handleRemoveComponent = (compKey: string) => {
    if (!mixinData) return;
    const nextComponents = { ...(mixinData.components ?? {}) };
    delete nextComponents[compKey];
    setMixinData({ ...mixinData, components: nextComponents });
    setDirty(true);
  };

  if (!mixinData) return <div>Loading...</div>;

  const currentComponents = mixinData.components ?? {};
  const attachedKeys = new Set(Object.keys(currentComponents));
  const availableSchemas = componentSchemas.filter(
    (s) => !attachedKeys.has(s.key) && !RUNTIME_INTENT_OR_TAG_KEYS.has(s.key),
  );

  return (
    <div className={styles.editor}>
      <div className={styles.editorHeader}>
        <h2 className={styles.editorTitle}>{isNew ? 'New Mixin' : `Mixin: ${name}`}</h2>
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
        <label className={styles.fieldLabel}>Name</label>
        <input
          className={styles.fieldInput}
          value={mixinData.name}
          onChange={(e) => {
            setMixinData({ ...mixinData, name: e.target.value });
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
