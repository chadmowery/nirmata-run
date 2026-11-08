'use client';
import { useState, useEffect } from 'react';
import type { FieldMeta } from '@/app/api/dev/gamedata/schema-introspect';
import type { ConditionNode, PayloadType } from '@/shared/components/augment-data';
import type { BehaviorTreeNode } from '@/shared/components/ai-tree';
import { FormField } from './FormField';
import { AugmentASTBuilder } from './AugmentASTBuilder';
import { BehaviorTreeEditor } from '../subeditors/BehaviorTreeEditor';
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
  const isAIState = componentKey === 'aiState';
  const [editingInlineTree, setEditingInlineTree] = useState(Boolean(values.inlineTree));
  const [availableTrees, setAvailableTrees] = useState<string[]>([]);
  const [availableSubtrees, setAvailableSubtrees] = useState<string[]>([]);

  useEffect(() => {
    if (isAIState) {
      fetch('/api/dev/gamedata/ai-trees')
        .then((r) => r.json())
        .then((data) => {
          if (Array.isArray(data.items)) setAvailableTrees(data.items);
          if (Array.isArray(data.subtrees)) setAvailableSubtrees(data.subtrees);
        })
        .catch(() => {
          setAvailableTrees([
            'basic',
            'buffer_overflow',
            'fragmenter',
            'logic_leaker',
            'null_pointer',
            'seed_eater',
            'system_admin',
          ]);
        });
    }
  }, [isAIState]);

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
          {componentKey === 'audioProfile' && (
            <span
              style={{
                fontSize: '10px',
                fontFamily: 'var(--font-mono, monospace)',
                color: 'var(--c-accent, #d8ff00)',
                background: 'rgba(216, 255, 0, 0.08)',
                padding: '1px 6px',
                borderRadius: '2px',
                border: '1px solid rgba(216, 255, 0, 0.25)',
              }}
            >
              AUDIO TELEMETRY // SFX BUS
            </span>
          )}
          {componentKey === 'ambientEmitter' && (
            <span
              style={{
                fontSize: '10px',
                fontFamily: 'var(--font-mono, monospace)',
                color: 'var(--c-accent-secondary, #00f0ff)',
                background: 'rgba(0, 240, 255, 0.08)',
                padding: '1px 6px',
                borderRadius: '2px',
                border: '1px solid rgba(0, 240, 255, 0.25)',
              }}
            >
              SPATIAL AMBIANCE EMITTER
            </span>
          )}
          {componentKey === 'aiState' && (
            <span
              style={{
                fontSize: '10px',
                fontFamily: 'var(--font-mono, monospace)',
                color: 'var(--c-accent-secondary, #00f0ff)',
                background: 'rgba(0, 240, 255, 0.08)',
                padding: '1px 6px',
                borderRadius: '2px',
                border: '1px solid rgba(0, 240, 255, 0.25)',
              }}
            >
              BEHAVIOR TREE v3.0
            </span>
          )}
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

      {isAIState && (
        <div style={{ marginBottom: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <label className={styles.fieldLabel} htmlFor="ai-tree-id-select">
              treeId
            </label>
            <select
              id="ai-tree-id-select"
              className={styles.fieldSelect}
              value={String(values.treeId ?? values.behaviorType ?? 'basic')}
              onChange={(e) => onChange(componentKey, 'treeId', e.target.value)}
              style={{ width: 'auto' }}
            >
              {(availableTrees.length > 0
                ? availableTrees
                : ['basic', 'buffer_overflow', 'fragmenter', 'logic_leaker', 'null_pointer', 'seed_eater', 'system_admin']
              ).map((tId) => (
                <option key={tId} value={tId}>
                  {tId}
                </option>
              ))}
            </select>
            <button
              type="button"
              className={styles.toolButton}
              onClick={() => {
                const next = !editingInlineTree;
                setEditingInlineTree(next);
                if (next && !values.inlineTree) {
                  onChange(componentKey, 'inlineTree', {
                    type: 'SELECTOR',
                    children: [
                      { type: 'SUBTREE', ref: 'skip-if-disrupted' },
                      {
                        type: 'SEQUENCE',
                        name: 'combat',
                        children: [
                          { type: 'CONDITION', condition: { check: 'CAN_SEE_TARGET' } },
                          { type: 'ACTION', task: { action: 'MOVE_DIJKSTRA', mapType: 'approach_target' } },
                        ],
                      },
                      { type: 'ACTION', task: { action: 'WAIT' } },
                    ],
                  });
                }
              }}
              style={{ fontSize: '10px', color: editingInlineTree ? 'var(--c-accent, #d8ff00)' : undefined }}
            >
              {editingInlineTree ? '[HIDE INLINE TREE]' : '[EDIT INLINE TREE]'}
            </button>
            {Boolean(values.inlineTree) && (
              <button
                type="button"
                className={styles.toolButton}
                onClick={() => {
                  onChange(componentKey, 'inlineTree', undefined);
                  setEditingInlineTree(false);
                }}
                style={{ fontSize: '10px', color: 'var(--c-danger, #ff2a4b)' }}
              >
                [REMOVE INLINE TREE]
              </button>
            )}
          </div>

          {editingInlineTree && Boolean(values.inlineTree) && (
            <BehaviorTreeEditor
              tree={values.inlineTree as BehaviorTreeNode}
              onChange={(tree) => onChange(componentKey, 'inlineTree', tree)}
              availableSubtrees={availableSubtrees}
            />
          )}
        </div>
      )}

      {fields
        .filter(
          (field) =>
            (!isAugment || (field.key !== 'trigger' && field.key !== 'payloads')) &&
            (!isAIState || (field.key !== 'treeId' && field.key !== 'inlineTree')),
        )
        .map((field) => (
          <FormField
            key={field.key}
            componentKey={componentKey}
            meta={field}
            value={values[field.key]}
            allValues={values}
            onChange={(key, val) => onChange(componentKey, key, val)}
          />
        ))}
    </div>
  );
}
