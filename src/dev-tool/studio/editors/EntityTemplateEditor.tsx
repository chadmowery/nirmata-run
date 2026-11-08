'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
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
  displayName?: string;
  tier?: number;
  software?: string[];
  mixins?: string[];
  components?: Record<string, Record<string, unknown>>;
  overrides?: Record<string, Record<string, unknown>>;
  [key: string]: unknown;
}

interface MixinDefinition {
  name: string;
  components?: Record<string, Record<string, unknown>>;
}

export function EntityTemplateEditor({ name, isNew, cloneFrom, onRefresh }: Props) {
  const {
    setCloneSource,
    selectItem,
    clearSelection,
    setDirty,
    setActiveEffectiveData,
    setActiveValidationStatus,
  } = useGamedataStore();

  const [templateData, setTemplateData] = useState<TemplateData | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [componentSchemas, setComponentSchemas] = useState<ComponentSchemaItem[]>([]);
  const [availableMixinNames, setAvailableMixinNames] = useState<string[]>([]);
  const [mixinDefinitions, setMixinDefinitions] = useState<Record<string, MixinDefinition>>({});

  // Load component schemas and mixins list
  useEffect(() => {
    fetch('/api/dev/gamedata/components')
      .then((r) => r.json())
      .then((data) => setComponentSchemas(data.items || []))
      .catch(() => {});

    fetch('/api/dev/gamedata/mixins')
      .then((r) => r.json())
      .then(async (data) => {
        const names: string[] = data.items || [];
        setAvailableMixinNames(names);

        // Fetch each mixin's full definition
        const defs: Record<string, MixinDefinition> = {};
        await Promise.all(
          names.map(async (mName) => {
            try {
              const res = await fetch(`/api/dev/gamedata/mixins/${mName}`);
              if (res.ok) {
                defs[mName] = await res.json();
              }
            } catch {
              // Ignore single mixin load failure
            }
          }),
        );
        setMixinDefinitions(defs);
      })
      .catch(() => {});
  }, []);

  const normalizeTemplate = (raw: TemplateData): TemplateData => {
    const copy = { ...raw };
    if (!copy.components) copy.components = {};
    if (!copy.overrides) copy.overrides = {};
    return copy;
  };

  // Load template data
  useEffect(() => {
    if (isNew && cloneFrom) {
      fetch(`/api/dev/gamedata/entities/${cloneFrom}`)
        .then((r) => r.json())
        .then((data) => {
          setTemplateData(normalizeTemplate({ ...data, name: '' }));
          setDirty(true);
        })
        .catch(() => setErrors(['Failed to load clone source']));
    } else if (!isNew && name) {
      fetch(`/api/dev/gamedata/entities/${name}`)
        .then((r) => r.json())
        .then((data) => {
          setTemplateData(normalizeTemplate(data));
          setDirty(false);
        })
        .catch(() => setErrors(['Failed to load template']));
    } else {
      setTemplateData({ name: '', mixins: [], components: {}, overrides: {} });
      setDirty(false);
    }
  }, [name, isNew, cloneFrom, setDirty]);

  // Compute inherited components and origin mixins
  const { inheritedComponents, mixinOrigins } = useMemo(() => {
    const inherited: Record<string, Record<string, unknown>> = {};
    const origins: Record<string, string> = {};

    if (!templateData?.mixins) return { inheritedComponents: inherited, mixinOrigins: origins };

    for (const mName of templateData.mixins) {
      const def = mixinDefinitions[mName];
      if (def?.components) {
        for (const [cKey, cVals] of Object.entries(def.components)) {
          if (!inherited[cKey]) {
            inherited[cKey] = { ...cVals };
            origins[cKey] = mName;
          }
        }
      }
    }

    return { inheritedComponents: inherited, mixinOrigins: origins };
  }, [templateData?.mixins, mixinDefinitions]);

  // Compute effective components: inherited + overrides + own components
  const effectiveComponents = useMemo(() => {
    if (!templateData) return {};
    const effective: Record<string, Record<string, unknown>> = {};

    // 1. Inherited components from mixins
    for (const [cKey, cVals] of Object.entries(inheritedComponents)) {
      effective[cKey] = { ...cVals };
    }

    // 2. Overrides applied to inherited components
    if (templateData.overrides) {
      for (const [cKey, oVals] of Object.entries(templateData.overrides)) {
        if (effective[cKey]) {
          effective[cKey] = { ...effective[cKey], ...oVals };
        } else {
          effective[cKey] = { ...oVals };
        }
      }
    }

    // 3. Own components
    if (templateData.components) {
      for (const [cKey, cVals] of Object.entries(templateData.components)) {
        effective[cKey] = { ...cVals };
      }
    }

    return effective;
  }, [templateData, inheritedComponents]);

  // Update telemetry store with resolved preview and validation
  useEffect(() => {
    if (!templateData) return;

    const ecsResult = validateEcsRules(effectiveComponents);

    setActiveEffectiveData({
      ...templateData,
      effectiveComponents,
    });

    setActiveValidationStatus({
      zodValid: Boolean(templateData.name.trim()),
      ecsResult,
    });
  }, [templateData, effectiveComponents, setActiveEffectiveData, setActiveValidationStatus]);

  const handleSave = useCallback(async () => {
    if (!templateData) return;
    setSaveStatus('saving');
    setErrors([]);
    setWarnings([]);

    if (!templateData.name.trim()) {
      setErrors(['Template name is required']);
      setSaveStatus('error');
      return;
    }

    // Validate ECS rules on effective components
    const ecsResult = validateEcsRules(effectiveComponents);
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
  }, [templateData, effectiveComponents, isNew, name, setDirty, onRefresh, selectItem]);

  // Global Cmd+S save shortcut listener
  useEffect(() => {
    const onSaveKey = () => {
      handleSave();
    };
    window.addEventListener('gamedata-save', onSaveKey);
    return () => window.removeEventListener('gamedata-save', onSaveKey);
  }, [handleSave]);

  const handleClone = () => {
    if (!templateData) return;
    setCloneSource(templateData.name || name);
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

  const handleAddMixin = (mixinName: string) => {
    if (!templateData) return;
    const current = templateData.mixins || [];
    if (!current.includes(mixinName)) {
      setTemplateData({
        ...templateData,
        mixins: [...current, mixinName],
      });
      setDirty(true);
    }
  };

  const handleRemoveMixin = (mixinName: string) => {
    if (!templateData) return;
    const nextMixins = (templateData.mixins || []).filter((m) => m !== mixinName);
    setTemplateData({
      ...templateData,
      mixins: nextMixins,
    });
    setDirty(true);
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
    const nextComponents = {
      ...(templateData.components ?? {}),
      [compKey]: { ...currentComp, [fieldKey]: value },
    };
    let nextOverrides = templateData.overrides;
    if (compKey === 'sprite' && nextOverrides?.sprite) {
      const rest = { ...nextOverrides };
      delete rest.sprite;
      nextOverrides = Object.keys(rest).length > 0 ? rest : undefined;
    }
    setTemplateData({
      ...templateData,
      components: nextComponents,
      overrides: nextOverrides,
    });
    setDirty(true);
  };

  const handleRemoveComponent = (compKey: string) => {
    if (!templateData) return;
    const nextComponents = { ...(templateData.components ?? {}) };
    delete nextComponents[compKey];
    let nextOverrides = templateData.overrides;
    if (compKey === 'sprite' && nextOverrides?.sprite) {
      const rest = { ...nextOverrides };
      delete rest.sprite;
      nextOverrides = Object.keys(rest).length > 0 ? rest : undefined;
    }
    setTemplateData({ ...templateData, components: nextComponents, overrides: nextOverrides });
    setDirty(true);
  };

  const handleOverrideFieldChange = (compKey: string, fieldKey: string, value: unknown) => {
    if (!templateData) return;
    const nextOverrides = { ...(templateData.overrides ?? {}) };
    const compOverrides = { ...(nextOverrides[compKey] ?? {}) };
    compOverrides[fieldKey] = value;
    nextOverrides[compKey] = compOverrides;

    setTemplateData({
      ...templateData,
      overrides: nextOverrides,
    });
    setDirty(true);
  };

  const handleResetOverride = (compKey: string) => {
    if (!templateData || !templateData.overrides) return;
    const nextOverrides = { ...templateData.overrides };
    delete nextOverrides[compKey];
    setTemplateData({
      ...templateData,
      overrides: Object.keys(nextOverrides).length > 0 ? nextOverrides : undefined,
    });
    setDirty(true);
  };

  if (!templateData) return <div>Loading...</div>;

  const currentComponents = templateData.components ?? {};
  const attachedOwnKeys = new Set(Object.keys(currentComponents));
  const inheritedKeys = Object.keys(inheritedComponents).filter((k) => !attachedOwnKeys.has(k));

  const allActiveComponentKeys = new Set([
    ...attachedOwnKeys,
    ...inheritedKeys,
  ]);

  const availableSchemas = componentSchemas.filter(
    (s) => !allActiveComponentKeys.has(s.key) && !RUNTIME_INTENT_OR_TAG_KEYS.has(s.key),
  );

  const availableAddMixins = availableMixinNames.filter(
    (m) => !(templateData.mixins || []).includes(m),
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

      {/* Identity & Metadata Section */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '8px',
          marginBottom: '12px',
        }}
      >
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

        <div className={styles.fieldRow}>
          <label className={styles.fieldLabel}>Display Name</label>
          <input
            className={styles.fieldInput}
            placeholder="e.g. Traxus Drone"
            value={templateData.displayName || ''}
            onChange={(e) => {
              setTemplateData({ ...templateData, displayName: e.target.value });
              setDirty(true);
            }}
          />
        </div>

        <div className={styles.fieldRow}>
          <label className={styles.fieldLabel}>Tier</label>
          <input
            type="number"
            min={1}
            max={5}
            className={styles.fieldInput}
            value={templateData.tier ?? ''}
            placeholder="1–5"
            onChange={(e) => {
              const val = e.target.value ? Number(e.target.value) : undefined;
              setTemplateData({ ...templateData, tier: val });
              setDirty(true);
            }}
          />
        </div>

        <div className={styles.fieldRow}>
          <label className={styles.fieldLabel}>Software (CSV)</label>
          <input
            className={styles.fieldInput}
            placeholder="e.g. EMP, System Shock"
            value={Array.isArray(templateData.software) ? templateData.software.join(', ') : ''}
            onChange={(e) => {
              const raw = e.target.value;
              const list = raw
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean);
              setTemplateData({ ...templateData, software: list.length > 0 ? list : undefined });
              setDirty(true);
            }}
          />
        </div>
      </div>

      {/* Mixins Selector Bar */}
      <div
        style={{
          background: 'var(--c-surface-elevated, #111722)',
          border: '1px solid var(--c-border, #1c2638)',
          borderRadius: '2px',
          padding: '8px 12px',
          marginBottom: '16px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '6px',
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-display, sans-serif)',
              fontSize: '11px',
              fontWeight: 700,
              color: 'var(--c-accent-secondary, #00f0ff)',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
          >
            INHERITED MIXINS ({templateData.mixins?.length || 0})
          </span>

          <select
            className={styles.componentSelect}
            style={{ width: 'auto', padding: '3px 8px', fontSize: '11px' }}
            onChange={(e) => {
              if (e.target.value) handleAddMixin(e.target.value);
            }}
            value=""
          >
            <option value="" disabled>
              + Attach Mixin ({availableAddMixins.length} available)
            </option>
            {availableAddMixins.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {(templateData.mixins || []).length === 0 && (
            <span style={{ fontSize: '11px', color: 'var(--c-text-dim, #79889e)' }}>
              No mixins attached. Components are defined solely in this template.
            </span>
          )}
          {(templateData.mixins || []).map((mName) => (
            <span
              key={mName}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '3px 8px',
                background: 'rgba(0, 240, 255, 0.08)',
                border: '1px solid var(--c-accent-secondary, #00f0ff)',
                borderRadius: '2px',
                fontSize: '11px',
                color: 'var(--c-accent-secondary, #00f0ff)',
              }}
            >
              {mName}
              <button
                type="button"
                onClick={() => handleRemoveMixin(mName)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--c-danger, #ff2a4b)',
                  cursor: 'pointer',
                  fontWeight: 700,
                  fontSize: '11px',
                }}
                title={`Detach mixin ${mName}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      </div>

      {/* Inherited Components & Overrides Section */}
      {inheritedKeys.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <div
            style={{
              fontFamily: 'var(--font-display, sans-serif)',
              fontSize: '11px',
              fontWeight: 700,
              color: 'var(--c-accent-secondary, #00f0ff)',
              letterSpacing: '0.08em',
              marginBottom: '8px',
              textTransform: 'uppercase',
            }}
          >
            INHERITED COMPONENTS (VIA MIXINS) — EDIT TO OVERRIDE
          </div>
          {inheritedKeys.map((cKey) => {
            const schema = componentSchemas.find((s) => s.key === cKey);
            const effectiveVals = effectiveComponents[cKey] || {};
            const isOverridden = Boolean(templateData.overrides?.[cKey]);

            return (
              <ComponentFieldGroup
                key={`inherited-${cKey}`}
                componentKey={cKey}
                fields={schema?.fields || []}
                values={effectiveVals}
                isInherited={true}
                originMixin={mixinOrigins[cKey]}
                isOverridden={isOverridden}
                onResetOverride={() => handleResetOverride(cKey)}
                onChange={handleOverrideFieldChange}
                onRemove={() => {}}
              />
            );
          })}
        </div>
      )}

      {/* Own Components Section */}
      <div style={{ marginBottom: '16px' }}>
        <div
          style={{
            fontFamily: 'var(--font-display, sans-serif)',
            fontSize: '11px',
            fontWeight: 700,
            color: 'var(--c-text-ivory, #f4f4f0)',
            letterSpacing: '0.08em',
            marginBottom: '8px',
            textTransform: 'uppercase',
          }}
        >
          OWN COMPONENTS ({Object.keys(currentComponents).length})
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
      </div>

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
