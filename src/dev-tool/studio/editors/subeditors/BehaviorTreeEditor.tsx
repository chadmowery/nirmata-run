'use client';
import React, { useState } from 'react';
import type {
  BehaviorTreeNode,
  AICondition,
  AIAction,
  UtilityConsideration,
} from '@/shared/components/ai-tree';
import styles from '../editors.module.css';

interface Props {
  tree: BehaviorTreeNode;
  onChange: (tree: BehaviorTreeNode) => void;
  disabled?: boolean;
  availableSubtrees?: string[];
}

const NODE_TYPES: BehaviorTreeNode['type'][] = [
  'SELECTOR',
  'SEQUENCE',
  'UTILITY_SELECTOR',
  'DECORATOR_COOLDOWN',
  'DECORATOR_INVERT',
  'DECORATOR_CHANCE',
  'SUBTREE',
  'CONDITION',
  'ACTION',
];

const CONDITION_CHECKS: AICondition['check'][] = [
  'CAN_SEE_TARGET',
  'HAS_LAST_KNOWN_TARGET_POS',
  'IS_ALERTED',
  'TARGET_DISTANCE_LTE',
  'TARGET_DISTANCE_GTE',
  'TARGET_DISTANCE_BETWEEN',
  'SELF_HP_BELOW_PERCENT',
  'HAS_STATUS_EFFECT',
  'IS_PACK_LEADER',
  'PACK_MEMBERS_ADJACENT_GTE',
  'IN_DIRECTIONAL_COVER_FROM_TARGET',
  'HAS_VALID_TELEPORT_AMBUSH_TILE',
];

const ACTION_TYPES: AIAction['action'][] = [
  'WAIT',
  'MELEE_BUMP_TARGET',
  'RANGED_ATTACK_TARGET',
  'MOVE_DIJKSTRA',
  'TELEPORT_AMBUSH_BEHIND_TARGET',
  'SPAWN_ENTITIES_AROUND_SELF',
];

const DIJKSTRA_MAP_TYPES = [
  'approach_target',
  'flee_from_target',
  'kite_to_cover',
  'pack_surround_cardinal',
  'investigate_last_known',
  'scavenge_nearest_loot',
  'patrol_anchors',
] as const;

const UTILITY_METRICS: UtilityConsideration['metric'][] = [
  'self_hp_ratio',
  'target_distance',
  'target_visible',
  'pack_adjacent_count',
  'nearby_loot_value',
  'in_cover',
];

const DEFAULT_SUBTREES = ['skip-if-disrupted', 'investigate-last-known-pos'];

export function BehaviorTreeEditor({
  tree,
  onChange,
  disabled,
  availableSubtrees = DEFAULT_SUBTREES,
}: Props) {
  const [showJsonRaw, setShowJsonRaw] = useState(false);

  return (
    <div
      style={{
        border: '1px solid var(--c-border-bright, #36445d)',
        borderRadius: '4px',
        padding: '12px',
        background: 'rgba(10, 16, 26, 0.7)',
        marginTop: '8px',
        marginBottom: '12px',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '10px',
          borderBottom: '1px solid var(--c-border-dim, #1c2638)',
          paddingBottom: '6px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              fontFamily: 'var(--font-mono, monospace)',
              fontSize: '12px',
              fontWeight: 700,
              color: 'var(--c-accent-secondary, #00f0ff)',
            }}
          >
            BEHAVIOR TREE AST BUILDER
          </span>
          <span style={{ fontSize: '10px', color: 'var(--c-text-dim, #79889e)' }}>
            v3.0 Stateless Tick-to-Intent
          </span>
        </div>
        <button
          type="button"
          className={styles.toolButton}
          onClick={() => setShowJsonRaw(!showJsonRaw)}
          style={{ fontSize: '10px', padding: '2px 8px' }}
        >
          {showJsonRaw ? 'HIDE RAW JSON' : 'VIEW RAW JSON'}
        </button>
      </div>

      {showJsonRaw && (
        <div style={{ marginBottom: '12px' }}>
          <textarea
            className={styles.fieldInput}
            style={{ width: '100%', minHeight: '140px', fontFamily: 'var(--font-mono, monospace)', fontSize: '11px' }}
            value={JSON.stringify(tree, null, 2)}
            readOnly
          />
        </div>
      )}

      <BTNodeView
        node={tree}
        onChange={onChange}
        depth={0}
        disabled={disabled}
        availableSubtrees={availableSubtrees}
      />
    </div>
  );
}

function BTNodeView({
  node,
  onChange,
  onRemove,
  depth = 0,
  disabled,
  availableSubtrees,
}: {
  node: BehaviorTreeNode;
  onChange: (newNode: BehaviorTreeNode) => void;
  onRemove?: () => void;
  depth?: number;
  disabled?: boolean;
  availableSubtrees: string[];
}) {
  const isComposite = node.type === 'SELECTOR' || node.type === 'SEQUENCE';
  const isDecorator =
    node.type === 'DECORATOR_COOLDOWN' ||
    node.type === 'DECORATOR_INVERT' ||
    node.type === 'DECORATOR_CHANCE';

  const borderColor = isComposite
    ? 'var(--c-accent-secondary, #00f0ff)'
    : isDecorator
      ? 'var(--c-accent, #d8ff00)'
      : node.type === 'UTILITY_SELECTOR'
        ? '#bf5af2'
        : node.type === 'ACTION'
          ? '#30d158'
          : 'var(--c-border-bright, #36445d)';

  const handleTypeChange = (newType: BehaviorTreeNode['type']) => {
    switch (newType) {
      case 'SELECTOR':
      case 'SEQUENCE': {
        const existingChildren = isComposite ? (node as { children: BehaviorTreeNode[] }).children : [];
        onChange({
          type: newType,
          name: (node as { name?: string }).name || undefined,
          children:
            existingChildren && existingChildren.length > 0
              ? existingChildren
              : [{ type: 'ACTION', task: { action: 'WAIT' } }],
        });
        break;
      }
      case 'UTILITY_SELECTOR':
        onChange({
          type: 'UTILITY_SELECTOR',
          name: (node as { name?: string }).name || undefined,
          branches: [
            {
              name: 'default-branch',
              weight: 1,
              considerations: [
                {
                  metric: 'target_distance',
                  curve: 'linear',
                  slope: 1,
                  invert: false,
                  minInput: 0,
                  maxInput: 10,
                },
              ],
              child: { type: 'ACTION', task: { action: 'WAIT' } },
            },
          ],
        });
        break;
      case 'DECORATOR_COOLDOWN':
        onChange({
          type: 'DECORATOR_COOLDOWN',
          cooldownId: 'ability_cooldown',
          turns: 3,
          child: { type: 'ACTION', task: { action: 'WAIT' } },
        });
        break;
      case 'DECORATOR_INVERT':
        onChange({
          type: 'DECORATOR_INVERT',
          child: { type: 'CONDITION', condition: { check: 'CAN_SEE_TARGET' } },
        });
        break;
      case 'DECORATOR_CHANCE':
        onChange({
          type: 'DECORATOR_CHANCE',
          probability: 0.5,
          child: { type: 'ACTION', task: { action: 'WAIT' } },
        });
        break;
      case 'SUBTREE':
        onChange({
          type: 'SUBTREE',
          ref: availableSubtrees[0] || 'skip-if-disrupted',
        });
        break;
      case 'CONDITION':
        onChange({
          type: 'CONDITION',
          condition: { check: 'CAN_SEE_TARGET' },
        });
        break;
      case 'ACTION':
        onChange({
          type: 'ACTION',
          task: { action: 'WAIT' },
        });
        break;
    }
  };

  return (
    <div
      style={{
        borderLeft: `3px solid ${borderColor}`,
        paddingLeft: '10px',
        marginTop: '8px',
        marginBottom: '8px',
        marginLeft: depth > 0 ? '12px' : '0px',
        background: depth % 2 === 0 ? 'rgba(255,255,255,0.015)' : 'transparent',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <span
          style={{
            fontSize: '10px',
            fontFamily: 'var(--font-mono, monospace)',
            color: 'var(--c-text-dim, #79889e)',
          }}
        >
          {depth === 0 ? 'ROOT' : `D${depth}`}
        </span>

        <select
          className={styles.fieldSelect}
          value={node.type}
          onChange={(e) => handleTypeChange(e.target.value as BehaviorTreeNode['type'])}
          disabled={disabled}
          style={{ width: 'auto', fontWeight: 700 }}
        >
          {NODE_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>

        {'name' in node && (
          <input
            type="text"
            className={styles.fieldInput}
            style={{ width: '140px', fontSize: '11px' }}
            placeholder="Branch Name (opt)"
            value={node.name ?? ''}
            onChange={(e) => onChange({ ...node, name: e.target.value || undefined } as BehaviorTreeNode)}
            disabled={disabled}
          />
        )}

        {onRemove && (
          <button
            type="button"
            className={styles.toolButton}
            onClick={onRemove}
            disabled={disabled}
            style={{ color: 'var(--c-danger, #ff2a4b)', padding: '1px 6px', fontSize: '11px' }}
            title="Remove Node"
          >
            ×
          </button>
        )}
      </div>

      {/* COMPOSITES (SELECTOR / SEQUENCE) */}
      {isComposite && (
        <div style={{ marginTop: '8px', marginLeft: '6px' }}>
          {(node as { children: BehaviorTreeNode[] }).children.map((child, idx) => (
            <BTNodeView
              key={idx}
              node={child}
              depth={depth + 1}
              onChange={(updatedChild) => {
                const nextChildren = [...(node as { children: BehaviorTreeNode[] }).children];
                nextChildren[idx] = updatedChild;
                onChange({ ...node, children: nextChildren } as BehaviorTreeNode);
              }}
              onRemove={
                (node as { children: BehaviorTreeNode[] }).children.length > 1
                  ? () => {
                      const nextChildren = (node as { children: BehaviorTreeNode[] }).children.filter(
                        (_, i) => i !== idx,
                      );
                      onChange({ ...node, children: nextChildren } as BehaviorTreeNode);
                    }
                  : undefined
              }
              disabled={disabled}
              availableSubtrees={availableSubtrees}
            />
          ))}

          <button
            type="button"
            className={styles.toolButton}
            onClick={() => {
              const nextChildren = [
                ...(node as { children: BehaviorTreeNode[] }).children,
                { type: 'ACTION', task: { action: 'WAIT' } } as BehaviorTreeNode,
              ];
              onChange({ ...node, children: nextChildren } as BehaviorTreeNode);
            }}
            disabled={disabled}
            style={{ marginTop: '6px', fontSize: '10px' }}
          >
            + Add Child Node
          </button>
        </div>
      )}

      {/* DECORATORS */}
      {node.type === 'DECORATOR_COOLDOWN' && (
        <div style={{ marginTop: '6px', marginLeft: '6px' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontSize: '11px', color: 'var(--c-text-dim, #79889e)' }}>Cooldown ID:</span>
            <input
              type="text"
              className={styles.fieldInput}
              style={{ width: '140px' }}
              value={node.cooldownId}
              onChange={(e) => onChange({ ...node, cooldownId: e.target.value })}
              disabled={disabled}
            />
            <span style={{ fontSize: '11px', color: 'var(--c-text-dim, #79889e)' }}>Turns:</span>
            <input
              type="number"
              className={styles.fieldInput}
              style={{ width: '60px' }}
              value={node.turns}
              min={1}
              onChange={(e) => onChange({ ...node, turns: Number(e.target.value) || 1 })}
              disabled={disabled}
            />
          </div>
          <BTNodeView
            node={node.child}
            depth={depth + 1}
            onChange={(child) => onChange({ ...node, child })}
            disabled={disabled}
            availableSubtrees={availableSubtrees}
          />
        </div>
      )}

      {node.type === 'DECORATOR_CHANCE' && (
        <div style={{ marginTop: '6px', marginLeft: '6px' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontSize: '11px', color: 'var(--c-text-dim, #79889e)' }}>Probability:</span>
            <input
              type="number"
              className={styles.fieldInput}
              style={{ width: '70px' }}
              step={0.05}
              min={0}
              max={1}
              value={node.probability}
              onChange={(e) => onChange({ ...node, probability: Number(e.target.value) })}
              disabled={disabled}
            />
          </div>
          <BTNodeView
            node={node.child}
            depth={depth + 1}
            onChange={(child) => onChange({ ...node, child })}
            disabled={disabled}
            availableSubtrees={availableSubtrees}
          />
        </div>
      )}

      {node.type === 'DECORATOR_INVERT' && (
        <div style={{ marginTop: '6px', marginLeft: '6px' }}>
          <BTNodeView
            node={node.child}
            depth={depth + 1}
            onChange={(child) => onChange({ ...node, child })}
            disabled={disabled}
            availableSubtrees={availableSubtrees}
          />
        </div>
      )}

      {/* SUBTREE */}
      {node.type === 'SUBTREE' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
          <span style={{ fontSize: '11px', color: 'var(--c-text-dim, #79889e)' }}>Ref Subtree:</span>
          <select
            className={styles.fieldSelect}
            value={node.ref}
            onChange={(e) => onChange({ ...node, ref: e.target.value })}
            disabled={disabled}
            style={{ width: 'auto' }}
          >
            {availableSubtrees.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* CONDITION */}
      {node.type === 'CONDITION' && (
        <ConditionNodeFields
          condition={node.condition}
          onChange={(condition) => onChange({ ...node, condition })}
          disabled={disabled}
        />
      )}

      {/* ACTION */}
      {node.type === 'ACTION' && (
        <ActionNodeFields
          task={node.task}
          onChange={(task) => onChange({ ...node, task })}
          disabled={disabled}
        />
      )}

      {/* UTILITY_SELECTOR */}
      {node.type === 'UTILITY_SELECTOR' && (
        <div style={{ marginTop: '8px', marginLeft: '6px' }}>
          {node.branches.map((b, idx) => (
            <div
              key={idx}
              style={{
                border: '1px dashed var(--c-border-bright, #36445d)',
                borderRadius: '4px',
                padding: '8px',
                marginBottom: '8px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#bf5af2' }}>Branch:</span>
                <input
                  type="text"
                  className={styles.fieldInput}
                  style={{ width: '120px' }}
                  value={b.name}
                  onChange={(e) => {
                    const nextBranches = [...node.branches];
                    nextBranches[idx] = { ...b, name: e.target.value };
                    onChange({ ...node, branches: nextBranches });
                  }}
                  disabled={disabled}
                />
                <span style={{ fontSize: '11px', color: 'var(--c-text-dim, #79889e)' }}>Weight:</span>
                <input
                  type="number"
                  className={styles.fieldInput}
                  style={{ width: '60px' }}
                  value={b.weight ?? 1}
                  step={0.1}
                  onChange={(e) => {
                    const nextBranches = [...node.branches];
                    nextBranches[idx] = { ...b, weight: Number(e.target.value) };
                    onChange({ ...node, branches: nextBranches });
                  }}
                  disabled={disabled}
                />
                {node.branches.length > 1 && (
                  <button
                    type="button"
                    className={styles.toolButton}
                    onClick={() => {
                      const nextBranches = node.branches.filter((_, i) => i !== idx);
                      onChange({ ...node, branches: nextBranches });
                    }}
                    disabled={disabled}
                    style={{ color: 'var(--c-danger, #ff2a4b)', padding: '1px 6px', fontSize: '11px' }}
                  >
                    ×
                  </button>
                )}
              </div>

              {/* Considerations */}
              <div style={{ marginBottom: '6px' }}>
                <span style={{ fontSize: '10px', color: 'var(--c-text-dim, #79889e)' }}>
                  Considerations ({b.considerations.length}):
                </span>
                {b.considerations.map((c, cIdx) => (
                  <div
                    key={cIdx}
                    style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '4px', flexWrap: 'wrap' }}
                  >
                    <select
                      className={styles.fieldSelect}
                      value={c.metric}
                      onChange={(e) => {
                        const nextCons = [...b.considerations];
                        nextCons[cIdx] = {
                          ...c,
                          metric: e.target.value as UtilityConsideration['metric'],
                        };
                        const nextBranches = [...node.branches];
                        nextBranches[idx] = { ...b, considerations: nextCons };
                        onChange({ ...node, branches: nextBranches });
                      }}
                      disabled={disabled}
                      style={{ width: 'auto', fontSize: '11px' }}
                    >
                      {UTILITY_METRICS.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>

                    <select
                      className={styles.fieldSelect}
                      value={c.curve ?? 'linear'}
                      onChange={(e) => {
                        const nextCons = [...b.considerations];
                        nextCons[cIdx] = {
                          ...c,
                          curve: e.target.value as UtilityConsideration['curve'],
                        };
                        const nextBranches = [...node.branches];
                        nextBranches[idx] = { ...b, considerations: nextCons };
                        onChange({ ...node, branches: nextBranches });
                      }}
                      disabled={disabled}
                      style={{ width: 'auto', fontSize: '11px' }}
                    >
                      {['linear', 'quadratic', 'logistic', 'step'].map((crv) => (
                        <option key={crv} value={crv}>
                          {crv}
                        </option>
                      ))}
                    </select>

                    <span style={{ fontSize: '10px', color: 'var(--c-text-dim, #79889e)' }}>Slope:</span>
                    <input
                      type="number"
                      className={styles.fieldInput}
                      style={{ width: '45px', fontSize: '11px' }}
                      step={0.1}
                      value={c.slope ?? 1}
                      onChange={(e) => {
                        const nextCons = [...b.considerations];
                        nextCons[cIdx] = { ...c, slope: Number(e.target.value) };
                        const nextBranches = [...node.branches];
                        nextBranches[idx] = { ...b, considerations: nextCons };
                        onChange({ ...node, branches: nextBranches });
                      }}
                      disabled={disabled}
                    />

                    <span style={{ fontSize: '10px', color: 'var(--c-text-dim, #79889e)' }}>In:</span>
                    <input
                      type="number"
                      className={styles.fieldInput}
                      style={{ width: '40px', fontSize: '11px' }}
                      value={c.minInput ?? 0}
                      onChange={(e) => {
                        const nextCons = [...b.considerations];
                        nextCons[cIdx] = { ...c, minInput: Number(e.target.value) };
                        const nextBranches = [...node.branches];
                        nextBranches[idx] = { ...b, considerations: nextCons };
                        onChange({ ...node, branches: nextBranches });
                      }}
                      disabled={disabled}
                    />
                    <span style={{ fontSize: '10px' }}>..</span>
                    <input
                      type="number"
                      className={styles.fieldInput}
                      style={{ width: '40px', fontSize: '11px' }}
                      value={c.maxInput ?? 1}
                      onChange={(e) => {
                        const nextCons = [...b.considerations];
                        nextCons[cIdx] = { ...c, maxInput: Number(e.target.value) };
                        const nextBranches = [...node.branches];
                        nextBranches[idx] = { ...b, considerations: nextCons };
                        onChange({ ...node, branches: nextBranches });
                      }}
                      disabled={disabled}
                    />

                    <label style={{ fontSize: '10px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                      <input
                        type="checkbox"
                        checked={c.invert ?? false}
                        onChange={(e) => {
                          const nextCons = [...b.considerations];
                          nextCons[cIdx] = { ...c, invert: e.target.checked };
                          const nextBranches = [...node.branches];
                          nextBranches[idx] = { ...b, considerations: nextCons };
                          onChange({ ...node, branches: nextBranches });
                        }}
                        disabled={disabled}
                      />
                      Inv
                    </label>

                    {b.considerations.length > 1 && (
                      <button
                        type="button"
                        className={styles.toolButton}
                        onClick={() => {
                          const nextCons = b.considerations.filter((_, i) => i !== cIdx);
                          const nextBranches = [...node.branches];
                          nextBranches[idx] = { ...b, considerations: nextCons };
                          onChange({ ...node, branches: nextBranches });
                        }}
                        disabled={disabled}
                        style={{ color: 'var(--c-danger, #ff2a4b)', padding: '1px 4px', fontSize: '10px' }}
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}

                <button
                  type="button"
                  className={styles.toolButton}
                  onClick={() => {
                    const nextCons = [
                      ...b.considerations,
                      {
                        metric: 'target_distance' as const,
                        curve: 'linear' as const,
                        slope: 1,
                        invert: false,
                        minInput: 0,
                        maxInput: 1,
                      },
                    ];
                    const nextBranches = [...node.branches];
                    nextBranches[idx] = { ...b, considerations: nextCons };
                    onChange({ ...node, branches: nextBranches });
                  }}
                  disabled={disabled}
                  style={{ fontSize: '9px', padding: '1px 6px', marginTop: '4px' }}
                >
                  + Add Consideration
                </button>
              </div>

              <BTNodeView
                node={b.child}
                depth={depth + 1}
                onChange={(newChild) => {
                  const nextBranches = [...node.branches];
                  nextBranches[idx] = { ...b, child: newChild };
                  onChange({ ...node, branches: nextBranches });
                }}
                disabled={disabled}
                availableSubtrees={availableSubtrees}
              />
            </div>
          ))}

          <button
            type="button"
            className={styles.toolButton}
            onClick={() => {
              const nextBranches = [
                ...node.branches,
                {
                  name: `branch_${node.branches.length + 1}`,
                  weight: 1,
                  considerations: [
                    {
                      metric: 'target_distance' as const,
                      curve: 'linear' as const,
                      slope: 1,
                      invert: false,
                      minInput: 0,
                      maxInput: 10,
                    },
                  ],
                  child: { type: 'ACTION' as const, task: { action: 'WAIT' as const } },
                },
              ];
              onChange({ ...node, branches: nextBranches });
            }}
            disabled={disabled}
            style={{ fontSize: '10px', marginTop: '4px' }}
          >
            + Add Utility Branch
          </button>
        </div>
      )}
    </div>
  );
}

function ConditionNodeFields({
  condition,
  onChange,
  disabled,
}: {
  condition: AICondition;
  onChange: (c: AICondition) => void;
  disabled?: boolean;
}) {
  const handleCheckChange = (newCheck: AICondition['check']) => {
    switch (newCheck) {
      case 'TARGET_DISTANCE_LTE':
      case 'TARGET_DISTANCE_GTE':
        onChange({ check: newCheck, distance: 1, metric: 'manhattan' });
        break;
      case 'TARGET_DISTANCE_BETWEEN':
        onChange({ check: newCheck, min: 2, max: 5, metric: 'manhattan' });
        break;
      case 'SELF_HP_BELOW_PERCENT':
        onChange({ check: newCheck, percent: 30 });
        break;
      case 'HAS_STATUS_EFFECT':
        onChange({ check: newCheck, target: 'self', statusName: 'DISRUPT' });
        break;
      case 'PACK_MEMBERS_ADJACENT_GTE':
        onChange({ check: newCheck, count: 2 });
        break;
      case 'HAS_VALID_TELEPORT_AMBUSH_TILE':
        onChange({ check: newCheck, minRange: 2, maxRange: 8 });
        break;
      default:
        onChange({ check: newCheck } as AICondition);
        break;
    }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '6px' }}>
      <select
        className={styles.fieldSelect}
        value={condition.check}
        onChange={(e) => handleCheckChange(e.target.value as AICondition['check'])}
        disabled={disabled}
        style={{ width: 'auto', fontSize: '11px' }}
      >
        {CONDITION_CHECKS.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>

      {(condition.check === 'TARGET_DISTANCE_LTE' || condition.check === 'TARGET_DISTANCE_GTE') && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ fontSize: '11px', color: 'var(--c-text-dim, #79889e)' }}>Dist:</span>
          <input
            type="number"
            className={styles.fieldInput}
            style={{ width: '60px' }}
            value={condition.distance}
            min={1}
            onChange={(e) => onChange({ ...condition, distance: Number(e.target.value) })}
            disabled={disabled}
          />
          <select
            className={styles.fieldSelect}
            value={condition.metric ?? 'manhattan'}
            onChange={(e) => onChange({ ...condition, metric: e.target.value as 'manhattan' | 'chebyshev' })}
            disabled={disabled}
            style={{ width: 'auto', fontSize: '11px' }}
          >
            <option value="manhattan">manhattan</option>
            <option value="chebyshev">chebyshev</option>
          </select>
        </div>
      )}

      {condition.check === 'TARGET_DISTANCE_BETWEEN' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ fontSize: '11px', color: 'var(--c-text-dim, #79889e)' }}>Range:</span>
          <input
            type="number"
            className={styles.fieldInput}
            style={{ width: '50px' }}
            value={condition.min}
            onChange={(e) => onChange({ ...condition, min: Number(e.target.value) })}
            disabled={disabled}
          />
          <span style={{ fontSize: '11px' }}>..</span>
          <input
            type="number"
            className={styles.fieldInput}
            style={{ width: '50px' }}
            value={condition.max}
            onChange={(e) => onChange({ ...condition, max: Number(e.target.value) })}
            disabled={disabled}
          />
          <select
            className={styles.fieldSelect}
            value={condition.metric ?? 'manhattan'}
            onChange={(e) => onChange({ ...condition, metric: e.target.value as 'manhattan' | 'chebyshev' })}
            disabled={disabled}
            style={{ width: 'auto', fontSize: '11px' }}
          >
            <option value="manhattan">manhattan</option>
            <option value="chebyshev">chebyshev</option>
          </select>
        </div>
      )}

      {condition.check === 'SELF_HP_BELOW_PERCENT' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ fontSize: '11px', color: 'var(--c-text-dim, #79889e)' }}>HP &lt;%:</span>
          <input
            type="number"
            className={styles.fieldInput}
            style={{ width: '60px' }}
            min={0}
            max={100}
            value={condition.percent}
            onChange={(e) => onChange({ ...condition, percent: Number(e.target.value) })}
            disabled={disabled}
          />
        </div>
      )}

      {condition.check === 'HAS_STATUS_EFFECT' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <select
            className={styles.fieldSelect}
            value={condition.target ?? 'self'}
            onChange={(e) => onChange({ ...condition, target: e.target.value as 'self' | 'target' })}
            disabled={disabled}
            style={{ width: 'auto', fontSize: '11px' }}
          >
            <option value="self">self</option>
            <option value="target">target</option>
          </select>
          <span style={{ fontSize: '11px', color: 'var(--c-text-dim, #79889e)' }}>Status:</span>
          <input
            type="text"
            className={styles.fieldInput}
            style={{ width: '100px' }}
            value={condition.statusName}
            onChange={(e) => onChange({ ...condition, statusName: e.target.value })}
            disabled={disabled}
          />
        </div>
      )}

      {condition.check === 'PACK_MEMBERS_ADJACENT_GTE' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ fontSize: '11px', color: 'var(--c-text-dim, #79889e)' }}>Count:</span>
          <input
            type="number"
            className={styles.fieldInput}
            style={{ width: '60px' }}
            min={1}
            value={condition.count}
            onChange={(e) => onChange({ ...condition, count: Number(e.target.value) })}
            disabled={disabled}
          />
        </div>
      )}

      {condition.check === 'HAS_VALID_TELEPORT_AMBUSH_TILE' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ fontSize: '11px', color: 'var(--c-text-dim, #79889e)' }}>Ambush Range:</span>
          <input
            type="number"
            className={styles.fieldInput}
            style={{ width: '50px' }}
            value={condition.minRange}
            onChange={(e) => onChange({ ...condition, minRange: Number(e.target.value) })}
            disabled={disabled}
          />
          <span style={{ fontSize: '11px' }}>..</span>
          <input
            type="number"
            className={styles.fieldInput}
            style={{ width: '50px' }}
            value={condition.maxRange}
            onChange={(e) => onChange({ ...condition, maxRange: Number(e.target.value) })}
            disabled={disabled}
          />
        </div>
      )}
    </div>
  );
}

function ActionNodeFields({
  task,
  onChange,
  disabled,
}: {
  task: AIAction;
  onChange: (a: AIAction) => void;
  disabled?: boolean;
}) {
  const handleActionChange = (newAction: AIAction['action']) => {
    const existingMsg =
      'combatMessage' in task
        ? task.combatMessage
        : task.action === 'WAIT'
          ? task.message
          : undefined;

    switch (newAction) {
      case 'MOVE_DIJKSTRA':
        onChange({
          action: 'MOVE_DIJKSTRA',
          mapType: 'approach_target',
          avoidHazards: true,
          canCrushProps: false,
          combatMessage: existingMsg,
        });
        break;
      case 'RANGED_ATTACK_TARGET':
        onChange({ action: 'RANGED_ATTACK_TARGET', combatMessage: existingMsg });
        break;
      case 'TELEPORT_AMBUSH_BEHIND_TARGET':
        onChange({
          action: 'TELEPORT_AMBUSH_BEHIND_TARGET',
          minRange: 2,
          maxRange: 8,
          searchRadius: 3,
          combatMessage: existingMsg,
        });
        break;
      case 'SPAWN_ENTITIES_AROUND_SELF':
        onChange({
          action: 'SPAWN_ENTITIES_AROUND_SELF',
          templateName: 'dead-zone',
          pattern: 'cardinal_4',
          count: 4,
          combatMessage: existingMsg,
        });
        break;
      case 'WAIT':
        onChange({ action: 'WAIT', message: existingMsg });
        break;
      case 'MELEE_BUMP_TARGET':
      default:
        onChange({ action: newAction });
        break;
    }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '6px' }}>
      <select
        className={styles.fieldSelect}
        value={task.action}
        onChange={(e) => handleActionChange(e.target.value as AIAction['action'])}
        disabled={disabled}
        style={{ width: 'auto', fontSize: '11px' }}
      >
        {ACTION_TYPES.map((a) => (
          <option key={a} value={a}>
            {a}
          </option>
        ))}
      </select>

      {task.action === 'MOVE_DIJKSTRA' && (
        <>
          <select
            className={styles.fieldSelect}
            value={task.mapType}
            onChange={(e) =>
              onChange({
                ...task,
                mapType: e.target.value as typeof DIJKSTRA_MAP_TYPES[number],
              })
            }
            disabled={disabled}
            style={{ width: 'auto', fontSize: '11px' }}
          >
            {DIJKSTRA_MAP_TYPES.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>

          <span style={{ fontSize: '11px', color: 'var(--c-text-dim, #79889e)' }}>OptRange:</span>
          <input
            type="number"
            className={styles.fieldInput}
            style={{ width: '45px', fontSize: '11px' }}
            placeholder="min"
            value={task.optimalRangeMin ?? ''}
            onChange={(e) =>
              onChange({
                ...task,
                optimalRangeMin: e.target.value !== '' ? Number(e.target.value) : undefined,
              })
            }
            disabled={disabled}
          />
          <span style={{ fontSize: '11px' }}>..</span>
          <input
            type="number"
            className={styles.fieldInput}
            style={{ width: '45px', fontSize: '11px' }}
            placeholder="max"
            value={task.optimalRangeMax ?? ''}
            onChange={(e) =>
              onChange({
                ...task,
                optimalRangeMax: e.target.value !== '' ? Number(e.target.value) : undefined,
              })
            }
            disabled={disabled}
          />

          <label style={{ fontSize: '10px', display: 'flex', alignItems: 'center', gap: '3px' }}>
            <input
              type="checkbox"
              checked={task.avoidHazards ?? true}
              onChange={(e) => onChange({ ...task, avoidHazards: e.target.checked })}
              disabled={disabled}
            />
            AvoidHazards
          </label>

          <label style={{ fontSize: '10px', display: 'flex', alignItems: 'center', gap: '3px' }}>
            <input
              type="checkbox"
              checked={task.canCrushProps ?? false}
              onChange={(e) => onChange({ ...task, canCrushProps: e.target.checked })}
              disabled={disabled}
            />
            CrushProps
          </label>
        </>
      )}

      {task.action === 'RANGED_ATTACK_TARGET' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ fontSize: '11px', color: 'var(--c-text-dim, #79889e)' }}>Status:</span>
          <input
            type="text"
            className={styles.fieldInput}
            style={{ width: '85px', fontSize: '11px' }}
            placeholder="Status (opt)"
            value={task.statusEffect?.name ?? ''}
            onChange={(e) => {
              const name = e.target.value;
              if (!name) {
                onChange({ ...task, statusEffect: undefined });
              } else {
                onChange({
                  ...task,
                  statusEffect: {
                    name,
                    duration: task.statusEffect?.duration ?? 3,
                    magnitude: task.statusEffect?.magnitude ?? 1,
                  },
                });
              }
            }}
            disabled={disabled}
          />
          {task.statusEffect && (
            <>
              <span style={{ fontSize: '10px', color: 'var(--c-text-dim, #79889e)' }}>Dur:</span>
              <input
                type="number"
                className={styles.fieldInput}
                style={{ width: '45px', fontSize: '11px' }}
                min={1}
                value={task.statusEffect.duration}
                onChange={(e) =>
                  onChange({
                    ...task,
                    statusEffect: {
                      ...task.statusEffect!,
                      duration: Number(e.target.value) || 1,
                    },
                  })
                }
                disabled={disabled}
              />
            </>
          )}
        </div>
      )}

      {task.action === 'TELEPORT_AMBUSH_BEHIND_TARGET' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ fontSize: '11px', color: 'var(--c-text-dim, #79889e)' }}>Range:</span>
          <input
            type="number"
            className={styles.fieldInput}
            style={{ width: '45px', fontSize: '11px' }}
            value={task.minRange ?? 2}
            onChange={(e) => onChange({ ...task, minRange: Number(e.target.value) })}
            disabled={disabled}
          />
          <span style={{ fontSize: '11px' }}>..</span>
          <input
            type="number"
            className={styles.fieldInput}
            style={{ width: '45px', fontSize: '11px' }}
            value={task.maxRange ?? 8}
            onChange={(e) => onChange({ ...task, maxRange: Number(e.target.value) })}
            disabled={disabled}
          />
          <span style={{ fontSize: '10px', color: 'var(--c-text-dim, #79889e)' }}>SearchRad:</span>
          <input
            type="number"
            className={styles.fieldInput}
            style={{ width: '45px', fontSize: '11px' }}
            value={task.searchRadius ?? 3}
            onChange={(e) => onChange({ ...task, searchRadius: Number(e.target.value) })}
            disabled={disabled}
          />
        </div>
      )}

      {task.action === 'SPAWN_ENTITIES_AROUND_SELF' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '11px', color: 'var(--c-text-dim, #79889e)' }}>Template:</span>
          <input
            type="text"
            className={styles.fieldInput}
            style={{ width: '90px' }}
            value={task.templateName}
            onChange={(e) => onChange({ ...task, templateName: e.target.value })}
            disabled={disabled}
          />
          <select
            className={styles.fieldSelect}
            value={task.pattern}
            onChange={(e) => onChange({ ...task, pattern: e.target.value as 'cardinal_4' | 'ring_radius_3' })}
            disabled={disabled}
            style={{ width: 'auto', fontSize: '11px' }}
          >
            <option value="cardinal_4">cardinal_4</option>
            <option value="ring_radius_3">ring_radius_3</option>
          </select>
          <span style={{ fontSize: '11px', color: 'var(--c-text-dim, #79889e)' }}>Count:</span>
          <input
            type="number"
            className={styles.fieldInput}
            style={{ width: '45px', fontSize: '11px' }}
            min={1}
            value={task.count ?? 4}
            onChange={(e) => onChange({ ...task, count: Number(e.target.value) || 1 })}
            disabled={disabled}
          />
          {task.templateName === 'dead-zone' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ fontSize: '10px', color: 'var(--c-text-dim, #79889e)' }}>DZ Turns:</span>
              <input
                type="number"
                className={styles.fieldInput}
                style={{ width: '45px', fontSize: '11px' }}
                min={1}
                value={task.deadZoneConfig?.remainingTurns ?? 6}
                onChange={(e) =>
                  onChange({
                    ...task,
                    deadZoneConfig: {
                      remainingTurns: Number(e.target.value) || 1,
                      damagePerTick: task.deadZoneConfig?.damagePerTick ?? 2,
                    },
                  })
                }
                disabled={disabled}
              />
              <span style={{ fontSize: '10px', color: 'var(--c-text-dim, #79889e)' }}>Dmg:</span>
              <input
                type="number"
                className={styles.fieldInput}
                style={{ width: '45px', fontSize: '11px' }}
                min={1}
                value={task.deadZoneConfig?.damagePerTick ?? 2}
                onChange={(e) =>
                  onChange({
                    ...task,
                    deadZoneConfig: {
                      remainingTurns: task.deadZoneConfig?.remainingTurns ?? 6,
                      damagePerTick: Number(e.target.value) || 1,
                    },
                  })
                }
                disabled={disabled}
              />
            </div>
          )}
        </div>
      )}

      {task.action === 'WAIT' && (
        <input
          type="text"
          className={styles.fieldInput}
          style={{ width: '160px', fontSize: '11px' }}
          placeholder="Wait / skip message (opt)"
          value={task.message ?? ''}
          onChange={(e) => onChange({ ...task, message: e.target.value || undefined })}
          disabled={disabled}
        />
      )}

      {task.action !== 'WAIT' && task.action !== 'MELEE_BUMP_TARGET' && (
        <input
          type="text"
          className={styles.fieldInput}
          style={{ width: '160px', fontSize: '11px' }}
          placeholder="Combat log message (opt)"
          value={(task as { combatMessage?: string }).combatMessage ?? ''}
          onChange={(e) => onChange({ ...task, combatMessage: e.target.value || undefined } as AIAction)}
          disabled={disabled}
        />
      )}
    </div>
  );
}
