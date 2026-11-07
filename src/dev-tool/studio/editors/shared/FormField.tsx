'use client';
import { useState, useEffect } from 'react';
import type { FieldMeta } from '@/app/api/dev/gamedata/schema-introspect';
import { SpritePicker } from '../../shared/SpritePicker';
import { AudioCuePicker } from '../../shared/AudioCuePicker';
import styles from '../editors.module.css';

interface FormFieldProps {
  meta: FieldMeta;
  value: unknown;
  onChange: (key: string, value: unknown) => void;
  disabled?: boolean;
  componentKey?: string;
  allValues?: Record<string, unknown>;
}

export function FormField({
  meta,
  value,
  onChange,
  disabled,
  componentKey,
  allValues,
}: FormFieldProps) {
  const { key, type, enumValues, optional } = meta;

  // Local draft state for array / object JSON editing
  const [draftJson, setDraftJson] = useState<string>(() => {
    if (value !== undefined && value !== null) {
      return JSON.stringify(value, null, 2);
    }
    return type === 'array' ? '[]' : '{}';
  });
  const [jsonError, setJsonError] = useState<string | null>(null);

  // Sync draft JSON when value changes from outside (e.g. template switch or reset)
  useEffect(() => {
    if (type === 'array' || type === 'object') {
      try {
        const currentParsed = JSON.parse(draftJson);
        if (JSON.stringify(currentParsed) !== JSON.stringify(value)) {
          if (value !== undefined && value !== null) {
            setDraftJson(JSON.stringify(value, null, 2));
          } else {
            setDraftJson(type === 'array' ? '[]' : '{}');
          }
          setJsonError(null);
        }
      } catch {
        // If current draft has parse error, don't overwrite user's in-progress typing unless value differs drastically
        if (value !== undefined && value !== null) {
          setDraftJson(JSON.stringify(value, null, 2));
          setJsonError(null);
        }
      }
    }
  }, [value, type, draftJson]);

  const handleChange = (val: unknown) => onChange(key, val);

  if (type === 'boolean') {
    return (
      <div className={styles.fieldRow}>
        <label className={styles.fieldLabel} htmlFor={`field-${key}`}>
          {key}
        </label>
        <input
          id={`field-${key}`}
          type="checkbox"
          className={styles.fieldCheckbox}
          checked={Boolean(value)}
          onChange={(e) => handleChange(e.target.checked)}
          disabled={disabled}
        />
      </div>
    );
  }

  if (type === 'enum' && enumValues) {
    const hasValue = value !== undefined && value !== null && value !== '';
    return (
      <div className={styles.fieldRow}>
        <label className={styles.fieldLabel} htmlFor={`field-${key}`}>
          {key}
        </label>
        <select
          id={`field-${key}`}
          className={styles.fieldSelect}
          value={hasValue ? String(value) : ''}
          onChange={(e) => handleChange(e.target.value)}
          disabled={disabled}
        >
          {!hasValue && (
            <option value="" disabled>
              -- Select {key} --
            </option>
          )}
          {enumValues.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (type === 'number') {
    const hasMinMax = meta.constraints?.min !== undefined && meta.constraints?.max !== undefined;
    const currentNum =
      value !== undefined && value !== null
        ? Number(value)
        : meta.defaultVal !== undefined
          ? Number(meta.defaultVal)
          : (meta.constraints?.min ?? 0);
    const step = meta.constraints?.isInt ? 1 : 0.05;

    return (
      <div className={styles.fieldRow}>
        <label className={styles.fieldLabel} htmlFor={`field-${key}`}>
          {key}{' '}
          {hasMinMax && (
            <span style={{ opacity: 0.6, fontSize: '10px' }}>
              ({meta.constraints?.min}..{meta.constraints?.max})
            </span>
          )}
        </label>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
          <input
            id={`field-${key}`}
            type="number"
            className={styles.fieldInput}
            value={value !== undefined && value !== null ? Number(value) : ''}
            min={meta.constraints?.min}
            max={meta.constraints?.max}
            step={step}
            onChange={(e) => {
              const raw = e.target.value;
              if (raw === '') {
                handleChange(optional ? undefined : 0);
              } else {
                handleChange(Number(raw));
              }
            }}
            disabled={disabled}
            style={{ width: hasMinMax ? '80px' : '100%', flex: hasMinMax ? 'none' : 1 }}
          />
          {hasMinMax && (
            <input
              type="range"
              min={meta.constraints?.min}
              max={meta.constraints?.max}
              step={step}
              value={currentNum}
              onChange={(e) => handleChange(Number(e.target.value))}
              disabled={disabled}
              className={styles.slider}
              style={{ flex: 1 }}
            />
          )}
        </div>
      </div>
    );
  }

  if (type === 'array' || type === 'object') {
    return (
      <div className={styles.fieldRow} style={{ alignItems: 'flex-start', flexDirection: 'column' }}>
        <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
          <label className={styles.fieldLabel} htmlFor={`field-${key}`}>
            {key} ({type.toUpperCase()})
          </label>
          {jsonError && (
            <span style={{ color: 'var(--c-danger, #ff2a4b)', fontSize: '11px', fontFamily: 'var(--font-mono, monospace)' }}>
              Syntax: {jsonError}
            </span>
          )}
        </div>
        <textarea
          id={`field-${key}`}
          className={styles.fieldInput}
          style={{ width: '100%', minHeight: '80px', fontFamily: 'var(--font-mono, monospace)' }}
          rows={Math.max(3, draftJson.split('\n').length)}
          value={draftJson}
          onChange={(e) => {
            const text = e.target.value;
            setDraftJson(text);
            try {
              const parsed = JSON.parse(text);
              setJsonError(null);
              handleChange(parsed);
            } catch (err) {
              setJsonError(err instanceof Error ? err.message : 'Invalid JSON');
            }
          }}
          disabled={disabled}
        />
      </div>
    );
  }

  // Audio Profile & Ambient Emitter Cue dropdown selector
  const isAudioCueField =
    (componentKey === 'audioProfile' &&
      (key === 'stepCue' ||
        key === 'attackCue' ||
        key === 'hitCue' ||
        key === 'deathCue' ||
        key === 'interactCue')) ||
    (componentKey === 'ambientEmitter' && key === 'cueId') ||
    key.endsWith('Cue');

  if (isAudioCueField) {
    const pitchMultiplier =
      typeof allValues?.pitchMultiplier === 'number' ? allValues.pitchMultiplier : 1.0;
    const volumeMultiplier =
      typeof allValues?.volumeMultiplier === 'number' ? allValues.volumeMultiplier : 1.0;

    return (
      <div className={styles.fieldRow}>
        <label className={styles.fieldLabel} htmlFor={`field-${key}`}>
          {key}
        </label>
        <div style={{ flex: 1 }}>
          <AudioCuePicker
            value={typeof value === 'string' ? value : undefined}
            onChange={(val) => handleChange(val)}
            fieldKey={key}
            componentKey={componentKey}
            pitchMultiplier={pitchMultiplier}
            volumeMultiplier={volumeMultiplier}
            disabled={disabled}
          />
        </div>
      </div>
    );
  }

  if (key === 'sprite' || (componentKey === 'sprite' && key === 'key')) {
    return (
      <div className={styles.fieldRow}>
        <label className={styles.fieldLabel} htmlFor={`field-${key}`}>
          {key}
        </label>
        <div style={{ flex: 1 }}>
          <SpritePicker
            value={String(value ?? '')}
            onChange={(val) => handleChange(val)}
            disabled={disabled}
          />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.fieldRow}>
      <label className={styles.fieldLabel} htmlFor={`field-${key}`}>
        {key}
      </label>
      <input
        id={`field-${key}`}
        type="text"
        className={styles.fieldInput}
        value={String(value ?? '')}
        onChange={(e) => handleChange(e.target.value)}
        disabled={disabled}
      />
    </div>
  );
}
