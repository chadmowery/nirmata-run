'use client';
import type { FieldMeta } from '@/app/api/dev/gamedata/schema-introspect';
import styles from '../editors.module.css';

interface FormFieldProps {
  meta: FieldMeta;
  value: unknown;
  onChange: (key: string, value: unknown) => void;
  disabled?: boolean;
}

export function FormField({ meta, value, onChange, disabled }: FormFieldProps) {
  const { key, type, enumValues } = meta;

  const handleChange = (val: unknown) => onChange(key, val);

  if (type === 'boolean') {
    return (
      <div className={styles.fieldRow}>
        <label className={styles.fieldLabel}>{key}</label>
        <input
          type="checkbox"
          className={styles.fieldCheckbox}
          checked={!!value}
          onChange={(e) => handleChange(e.target.checked)}
          disabled={disabled}
        />
      </div>
    );
  }

  if (type === 'enum' && enumValues) {
    return (
      <div className={styles.fieldRow}>
        <label className={styles.fieldLabel}>{key}</label>
        <select
          className={styles.fieldSelect}
          value={String(value || '')}
          onChange={(e) => handleChange(e.target.value)}
          disabled={disabled}
        >
          {enumValues.map((v) => (
            <option key={v} value={v}>{v}</option>
          ))}
        </select>
      </div>
    );
  }

  if (type === 'number') {
    return (
      <div className={styles.fieldRow}>
        <label className={styles.fieldLabel}>{key}</label>
        <input
          type="number"
          className={styles.fieldInput}
          value={Number(value ?? 0)}
          onChange={(e) => handleChange(Number(e.target.value))}
          disabled={disabled}
        />
      </div>
    );
  }

  if (type === 'array' || type === 'object') {
    return (
      <div className={styles.fieldRow} style={{ alignItems: 'flex-start' }}>
        <label className={styles.fieldLabel}>{key} (JSON)</label>
        <textarea
          className={styles.fieldInput}
          rows={3}
          value={JSON.stringify(value, null, 2)}
          onChange={(e) => {
            try {
              handleChange(JSON.parse(e.target.value));
            } catch {
              // ignore parse errors while typing
            }
          }}
          disabled={disabled}
        />
      </div>
    );
  }

  return (
    <div className={styles.fieldRow}>
      <label className={styles.fieldLabel}>{key}</label>
      <input
        type="text"
        className={styles.fieldInput}
        value={String(value ?? '')}
        onChange={(e) => handleChange(e.target.value)}
        disabled={disabled}
      />
    </div>
  );
}
