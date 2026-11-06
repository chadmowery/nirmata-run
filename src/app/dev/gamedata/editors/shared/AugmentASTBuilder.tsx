'use client';
import type { ConditionNode, PayloadType } from '@/shared/components/augment-data';
import styles from '../editors.module.css';

interface Props {
  trigger: ConditionNode;
  payloads: PayloadType[];
  onTriggerChange: (trigger: ConditionNode) => void;
  onPayloadsChange: (payloads: PayloadType[]) => void;
  disabled?: boolean;
}

const CONDITION_TYPES: ConditionNode['type'][] = [
  'AND',
  'OR',
  'NOT',
  'ON_ACTIVATION',
  'ON_TARGET_HIT',
  'ON_OVERCLOCK',
  'ON_KILL',
  'HEAT_ABOVE',
  'HP_BELOW_PERCENT',
  'ON_HACK',
  'ON_COVER_BROKEN',
];

const PAYLOAD_TYPES: PayloadType['type'][] = [
  'HEAL',
  'SHIELD',
  'APPLY_STATUS',
  'VENT_HEAT',
  'DAMAGE_BONUS',
];

function isBranchType(type: ConditionNode['type']): boolean {
  return type === 'AND' || type === 'OR' || type === 'NOT';
}

function ConditionNodeEditor({
  node,
  onChange,
  onRemove,
  depth = 0,
  disabled,
}: {
  node: ConditionNode;
  onChange: (newNode: ConditionNode) => void;
  onRemove?: () => void;
  depth?: number;
  disabled?: boolean;
}) {
  const isBranch = isBranchType(node.type);
  const needsValue = node.type === 'HEAT_ABOVE' || node.type === 'HP_BELOW_PERCENT';

  const handleTypeChange = (newType: ConditionNode['type']) => {
    const nextIsBranch = isBranchType(newType);
    onChange({
      type: newType,
      conditions: nextIsBranch ? node.conditions || [{ type: 'ON_ACTIVATION' }] : undefined,
      value: newType === 'HEAT_ABOVE' || newType === 'HP_BELOW_PERCENT' ? (node.value ?? 50) : undefined,
    });
  };

  const handleAddChild = () => {
    const current = node.conditions || [];
    onChange({
      ...node,
      conditions: [...current, { type: 'ON_TARGET_HIT' }],
    });
  };

  const handleChildChange = (index: number, updatedChild: ConditionNode) => {
    const current = [...(node.conditions || [])];
    current[index] = updatedChild;
    onChange({ ...node, conditions: current });
  };

  const handleChildRemove = (index: number) => {
    const current = (node.conditions || []).filter((_, i) => i !== index);
    onChange({ ...node, conditions: current });
  };

  return (
    <div
      style={{
        borderLeft: `2px solid ${isBranch ? 'var(--c-accent-secondary, #00f0ff)' : 'var(--c-border-bright, #36445d)'}`,
        paddingLeft: '10px',
        marginTop: '6px',
        marginBottom: '6px',
        marginLeft: depth > 0 ? '8px' : '0px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '10px', color: 'var(--c-text-dim, #79889e)' }}>
          {depth === 0 ? 'ROOT' : 'BRANCH'}
        </span>
        <select
          className={styles.fieldSelect}
          value={node.type}
          onChange={(e) => handleTypeChange(e.target.value as ConditionNode['type'])}
          disabled={disabled}
          style={{ width: 'auto', fontWeight: isBranch ? 700 : 400 }}
        >
          {CONDITION_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>

        {needsValue && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ fontSize: '11px', color: 'var(--c-text-dim, #79889e)' }}>Threshold:</span>
            <input
              type="number"
              className={styles.fieldInput}
              style={{ width: '70px' }}
              value={node.value ?? 0}
              onChange={(e) => onChange({ ...node, value: Number(e.target.value) })}
              disabled={disabled}
            />
          </div>
        )}

        {onRemove && (
          <button
            type="button"
            className={styles.toolButton}
            onClick={onRemove}
            disabled={disabled}
            style={{ color: 'var(--c-danger, #ff2a4b)', padding: '2px 6px', fontSize: '10px' }}
          >
            ×
          </button>
        )}
      </div>

      {isBranch && (
        <div style={{ marginTop: '6px', marginLeft: '6px' }}>
          {(node.conditions || []).map((child, idx) => (
            <ConditionNodeEditor
              key={idx}
              node={child}
              depth={depth + 1}
              onChange={(updated) => handleChildChange(idx, updated)}
              onRemove={() => handleChildRemove(idx)}
              disabled={disabled}
            />
          ))}
          <button
            type="button"
            className={styles.toolButton}
            onClick={handleAddChild}
            disabled={disabled}
            style={{ fontSize: '10px', marginTop: '4px', padding: '2px 8px' }}
          >
            + ADD CHILD CONDITION
          </button>
        </div>
      )}
    </div>
  );
}

export function AugmentASTBuilder({
  trigger,
  payloads,
  onTriggerChange,
  onPayloadsChange,
  disabled,
}: Props) {
  const handleAddPayload = () => {
    onPayloadsChange([
      ...payloads,
      { type: 'DAMAGE_BONUS', magnitude: 5 },
    ]);
  };

  const handleUpdatePayload = (index: number, updated: PayloadType) => {
    const next = [...payloads];
    next[index] = updated;
    onPayloadsChange(next);
  };

  const handleRemovePayload = (index: number) => {
    onPayloadsChange(payloads.filter((_, i) => i !== index));
  };

  return (
    <div
      style={{
        background: 'var(--c-surface-elevated, #111722)',
        border: '1px solid var(--c-border, #1c2638)',
        borderRadius: '2px',
        padding: '10px',
        marginTop: '8px',
        marginBottom: '8px',
      }}
    >
      <div
        style={{
          fontFamily: 'var(--font-display, sans-serif)',
          fontSize: '11px',
          fontWeight: 700,
          color: 'var(--c-accent-secondary, #00f0ff)',
          letterSpacing: '0.08em',
          marginBottom: '8px',
        }}
      >
        AUGMENT CONDITION TREE & PAYLOADS
      </div>

      <div style={{ marginBottom: '12px' }}>
        <div style={{ fontSize: '11px', color: 'var(--c-text-ivory, #f4f4f0)', marginBottom: '4px' }}>
          TRIGGER CONDITION (AST):
        </div>
        <ConditionNodeEditor
          node={trigger || { type: 'ON_ACTIVATION' }}
          onChange={onTriggerChange}
          disabled={disabled}
        />
      </div>

      <div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '6px',
          }}
        >
          <span style={{ fontSize: '11px', color: 'var(--c-text-ivory, #f4f4f0)' }}>
            ACTION PAYLOADS ({payloads?.length || 0}):
          </span>
          <button
            type="button"
            className={styles.toolButton}
            onClick={handleAddPayload}
            disabled={disabled}
            style={{ fontSize: '10px', padding: '2px 8px' }}
          >
            + ADD PAYLOAD
          </button>
        </div>

        {(payloads || []).map((p, idx) => (
          <div
            key={idx}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px',
              background: 'var(--c-surface, #0a0e15)',
              border: '1px solid var(--c-border, #1c2638)',
              borderRadius: '2px',
              marginBottom: '4px',
              flexWrap: 'wrap',
            }}
          >
            <select
              className={styles.fieldSelect}
              value={p.type}
              onChange={(e) =>
                handleUpdatePayload(idx, {
                  ...p,
                  type: e.target.value as PayloadType['type'],
                })
              }
              disabled={disabled}
              style={{ width: 'auto' }}
            >
              {PAYLOAD_TYPES.map((pt) => (
                <option key={pt} value={pt}>
                  {pt}
                </option>
              ))}
            </select>

            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ fontSize: '10px', color: 'var(--c-text-dim, #79889e)' }}>Mag:</span>
              <input
                type="number"
                className={styles.fieldInput}
                style={{ width: '60px' }}
                value={p.magnitude ?? 0}
                onChange={(e) =>
                  handleUpdatePayload(idx, { ...p, magnitude: Number(e.target.value) })
                }
                disabled={disabled}
              />
            </div>

            {p.type === 'APPLY_STATUS' && (
              <>
                <input
                  type="text"
                  placeholder="status effect name"
                  className={styles.fieldInput}
                  style={{ width: '120px' }}
                  value={p.statusEffectName ?? ''}
                  onChange={(e) =>
                    handleUpdatePayload(idx, { ...p, statusEffectName: e.target.value })
                  }
                  disabled={disabled}
                />
                <input
                  type="number"
                  placeholder="duration"
                  className={styles.fieldInput}
                  style={{ width: '60px' }}
                  value={p.statusEffectDuration ?? 1}
                  onChange={(e) =>
                    handleUpdatePayload(idx, {
                      ...p,
                      statusEffectDuration: Number(e.target.value),
                    })
                  }
                  disabled={disabled}
                />
              </>
            )}

            <button
              type="button"
              className={styles.toolButton}
              onClick={() => handleRemovePayload(idx)}
              disabled={disabled}
              style={{
                color: 'var(--c-danger, #ff2a4b)',
                marginLeft: 'auto',
                padding: '2px 6px',
                fontSize: '10px',
              }}
            >
              × REMOVE
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
