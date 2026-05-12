'use client';
import type { FieldMeta } from '@/app/api/dev/gamedata/schema-introspect';
import { FormField } from './FormField';
import styles from '../editors.module.css';

interface Props {
  componentKey: string;
  fields: FieldMeta[];
  values: Record<string, unknown>;
  onChange: (componentKey: string, fieldKey: string, value: unknown) => void;
  onRemove: (componentKey: string) => void;
}

export function ComponentFieldGroup({ componentKey, fields, values, onChange, onRemove }: Props) {
  return (
    <div className={styles.fieldGroup}>
      <div className={styles.fieldGroupHeader}>
        <span className={styles.fieldGroupTitle}>{componentKey}</span>
        <button className={styles.removeButton} onClick={() => onRemove(componentKey)}>
          REMOVE
        </button>
      </div>
      {fields.map((field) => (
        <FormField
          key={field.key}
          meta={field}
          value={values[field.key]}
          onChange={(key, val) => onChange(componentKey, key, val)}
        />
      ))}
    </div>
  );
}
