'use client';
import { useState, useEffect } from 'react';
import type { FieldMeta } from '@/app/api/dev/gamedata/schema-introspect';
import styles from './editors.module.css';

interface Props {
  name?: string; // Optional component key
}

export function ComponentSchemaViewer({ name }: Props) {
  const [components, setComponents] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/dev/gamedata/components')
      .then((r) => r.json())
      .then((data) => setComponents(data.items));
  }, []);

  const filtered = name ? components.filter(c => c.key === name) : components;

  return (
    <div className={styles.editor}>
      <h2 className={styles.editorTitle}>{name ? `Component: ${name}` : 'Component Schema Registry'}</h2>
      {filtered.map((comp) => (
        <div key={comp.key} className={styles.fieldGroup}>
          <h3 className={styles.fieldGroupTitle}>{comp.key}</h3>
          {comp.fields.map((field: FieldMeta) => (
            <div key={field.key} className={styles.fieldRow}>
              <span className={styles.fieldLabel}>{field.key}</span>
              <span className={styles.readOnlyField}>
                {field.type} {field.optional ? '(optional)' : '(required)'}
                {field.enumValues ? ` [${field.enumValues.join(', ')}]` : ''}
              </span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
