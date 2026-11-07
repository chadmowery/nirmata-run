'use client';
import type { FieldMeta } from '@/app/api/dev/gamedata/schema-introspect';
import type { ConditionNode, PayloadType } from '@/shared/components/augment-data';
import { FormField } from './FormField';
import { AugmentASTBuilder } from './AugmentASTBuilder';
import styles from '../editors.module.css';

interface Props {
  componentKey: string;
  fields: FieldMeta[];
  values: Record<string, unknown>;
  onChange: (componentKey: string, fieldKey: string, value: unknown) => void;
  onRemove: (componentKey: string) => void;
  isInherited?: boolean;
  originMixin?: string;
  isOverridden?: boolean;
  onResetOverride?: () => void;
}

export function ComponentFieldGroup({
  componentKey,
  fields,
  values,
  onChange,
  onRemove,
  isInherited,
  originMixin,
  isOverridden,
  onResetOverride,
}: Props) {
  const isAugment = componentKey === 'augmentData';

  return (
    <div
      className={styles.fieldGroup}
      style={{
        borderLeft: isInherited ? '3px solid var(--c-accent-secondary, #00f0ff)' : undefined,
      }}
    >
      <div className={styles.fieldGroupHeader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className={styles.fieldGroupTitle}>{componentKey}</span>
          {isInherited && (
            <span
              style={{
                fontSize: '10px',
                fontFamily: 'var(--font-mono, monospace)',
                color: 'var(--c-accent-secondary, #00f0ff)',
                background: 'rgba(0, 240, 255, 0.1)',
                padding: '1px 6px',
                borderRadius: '2px',
                border: '1px solid rgba(0, 240, 255, 0.3)',
              }}
            >
              FROM: {originMixin}
            </span>
          )}
          {isOverridden && (
            <span
              style={{
                fontSize: '10px',
                fontFamily: 'var(--font-mono, monospace)',
                color: 'var(--c-warning, #ff6600)',
                background: 'rgba(255, 102, 0, 0.1)',
                padding: '1px 6px',
                borderRadius: '2px',
                border: '1px solid rgba(255, 102, 0, 0.3)',
              }}
            >
              [OVERRIDDEN]
            </span>
          )}
        </div>

        <div style={{ display: 'flex', gap: '6px' }}>
          {isOverridden && onResetOverride && (
            <button
              className={styles.toolButton}
              onClick={onResetOverride}
              style={{ color: 'var(--c-warning, #ff6600)', fontSize: '10px' }}
              title="Reset overrides to inherited defaults"
            >
              RESET OVERRIDE
            </button>
          )}
          {onRemove && (
            <button className={styles.removeButton} onClick={() => onRemove(componentKey)}>
              REMOVE
            </button>
          )}
        </div>
      </div>

      {isAugment && (
        <AugmentASTBuilder
          trigger={(values.trigger as ConditionNode) || { type: 'ON_ACTIVATION' }}
          payloads={(values.payloads as PayloadType[]) || []}
          onTriggerChange={(trig) => onChange(componentKey, 'trigger', trig)}
          onPayloadsChange={(pls) => onChange(componentKey, 'payloads', pls)}
        />
      )}

      {fields
        .filter((field) => !isAugment || (field.key !== 'trigger' && field.key !== 'payloads'))
        .map((field) => (
          <FormField
            key={field.key}
            componentKey={componentKey}
            meta={field}
            value={values[field.key]}
            onChange={(key, val) => onChange(componentKey, key, val)}
          />
        ))}
    </div>
  );
}
