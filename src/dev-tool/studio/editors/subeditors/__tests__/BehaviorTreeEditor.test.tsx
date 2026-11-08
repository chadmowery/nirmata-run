import React from 'react';
import '@testing-library/jest-dom';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BehaviorTreeEditor } from '../BehaviorTreeEditor';
import { BehaviorTreeNodeSchema, type BehaviorTreeNode } from '@/shared/components/ai-tree';

describe('BehaviorTreeEditor Component', () => {
  const sampleTree: BehaviorTreeNode = {
    type: 'SELECTOR',
    name: 'root-selector',
    children: [
      {
        type: 'SEQUENCE',
        name: 'combat-sequence',
        children: [
          {
            type: 'CONDITION',
            condition: { check: 'CAN_SEE_TARGET' },
          },
          {
            type: 'ACTION',
            task: {
              action: 'MOVE_DIJKSTRA',
              mapType: 'approach_target',
              avoidHazards: true,
              canCrushProps: false,
            },
          },
        ],
      },
      {
        type: 'ACTION',
        task: { action: 'WAIT' },
      },
    ],
  };

  it('renders root selector, sequences, conditions, and actions', () => {
    const onChange = vi.fn();
    render(<BehaviorTreeEditor tree={sampleTree} onChange={onChange} />);

    expect(screen.getByText(/BEHAVIOR TREE AST BUILDER/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue('root-selector')).toBeInTheDocument();
    expect(screen.getByDisplayValue('combat-sequence')).toBeInTheDocument();
    expect(screen.getByDisplayValue('CAN_SEE_TARGET')).toBeInTheDocument();
    expect(screen.getByDisplayValue('MOVE_DIJKSTRA')).toBeInTheDocument();
  });

  it('toggles raw JSON preview panel', () => {
    const onChange = vi.fn();
    render(<BehaviorTreeEditor tree={sampleTree} onChange={onChange} />);

    expect(screen.queryByText(/\"root-selector\"/i)).not.toBeInTheDocument();

    const toggleBtn = screen.getByText(/VIEW RAW JSON/i);
    fireEvent.click(toggleBtn);

    expect(screen.getByText(/HIDE RAW JSON/i)).toBeInTheDocument();
    const textarea = document.querySelector('textarea');
    expect(textarea).toBeInTheDocument();
    expect(textarea?.value).toContain('root-selector');
  });

  it('allows changing branch names and emits updated tree', () => {
    const onChange = vi.fn();
    render(<BehaviorTreeEditor tree={sampleTree} onChange={onChange} />);

    const rootNameInput = screen.getByDisplayValue('root-selector');
    fireEvent.change(rootNameInput, { target: { value: 'renamed-root' } });

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'SELECTOR',
        name: 'renamed-root',
      }),
    );
  });

  it('allows adding child nodes', () => {
    const onChange = vi.fn();
    render(<BehaviorTreeEditor tree={sampleTree} onChange={onChange} />);

    const addButtons = screen.getAllByText(/\+ Add Child Node/i);
    fireEvent.click(addButtons[0]);

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'SELECTOR',
        children: expect.arrayContaining([
          expect.anything(),
          expect.anything(),
          expect.objectContaining({ type: 'ACTION', task: { action: 'WAIT' } }),
        ]),
      }),
    );
  });

  it('supports changing node type from ACTION to DECORATOR_COOLDOWN', () => {
    const onChange = vi.fn();
    const leafTree: BehaviorTreeNode = {
      type: 'ACTION',
      task: { action: 'WAIT' },
    };
    render(<BehaviorTreeEditor tree={leafTree} onChange={onChange} />);

    const typeSelect = screen.getByDisplayValue('ACTION');
    fireEvent.change(typeSelect, { target: { value: 'DECORATOR_COOLDOWN' } });

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'DECORATOR_COOLDOWN',
        cooldownId: 'ability_cooldown',
        turns: 3,
      }),
    );
  });

  it('generates schema-valid AST when switching to SELECTOR, SEQUENCE, or UTILITY_SELECTOR', () => {
    const onChange = vi.fn();
    const leafTree: BehaviorTreeNode = {
      type: 'ACTION',
      task: { action: 'WAIT' },
    };
    const { unmount } = render(<BehaviorTreeEditor tree={leafTree} onChange={onChange} />);

    // Test SELECTOR
    const typeSelect = screen.getByDisplayValue('ACTION');
    fireEvent.change(typeSelect, { target: { value: 'SELECTOR' } });
    const selectorResult = onChange.mock.calls[0][0];
    expect(BehaviorTreeNodeSchema.safeParse(selectorResult).success).toBe(true);
    expect(selectorResult.children.length).toBeGreaterThanOrEqual(1);

    // Test SEQUENCE
    onChange.mockClear();
    fireEvent.change(typeSelect, { target: { value: 'SEQUENCE' } });
    const sequenceResult = onChange.mock.calls[0][0];
    expect(BehaviorTreeNodeSchema.safeParse(sequenceResult).success).toBe(true);
    expect(sequenceResult.children.length).toBeGreaterThanOrEqual(1);

    // Test UTILITY_SELECTOR
    onChange.mockClear();
    fireEvent.change(typeSelect, { target: { value: 'UTILITY_SELECTOR' } });
    const utilityResult = onChange.mock.calls[0][0];
    expect(BehaviorTreeNodeSchema.safeParse(utilityResult).success).toBe(true);
    expect(utilityResult.branches.length).toBeGreaterThanOrEqual(1);
    expect(utilityResult.branches[0].considerations.length).toBeGreaterThanOrEqual(1);

    unmount();
  });

  it('preserves combatMessage across action type switches and renders schema fields', () => {
    const onChange = vi.fn();
    const actionTree: BehaviorTreeNode = {
      type: 'ACTION',
      task: {
        action: 'MOVE_DIJKSTRA',
        mapType: 'approach_target',
        optimalRangeMin: 3,
        optimalRangeMax: 5,
        avoidHazards: true,
        canCrushProps: false,
        combatMessage: 'Approaching target...',
      },
    };
    render(<BehaviorTreeEditor tree={actionTree} onChange={onChange} />);

    // Check that combatMessage input exists with current value
    const msgInput = screen.getByDisplayValue('Approaching target...');
    expect(msgInput).toBeInTheDocument();

    // Check optimal range inputs exist
    expect(screen.getByDisplayValue('3')).toBeInTheDocument();
    expect(screen.getByDisplayValue('5')).toBeInTheDocument();

    // Switch action to RANGED_ATTACK_TARGET
    const actionSelect = screen.getByDisplayValue('MOVE_DIJKSTRA');
    fireEvent.change(actionSelect, { target: { value: 'RANGED_ATTACK_TARGET' } });

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'ACTION',
        task: expect.objectContaining({
          action: 'RANGED_ATTACK_TARGET',
          combatMessage: 'Approaching target...',
        }),
      }),
    );
  });

  it('seeds non-empty considerations when adding a utility branch', () => {
    const onChange = vi.fn();
    const utilityTree: BehaviorTreeNode = {
      type: 'UTILITY_SELECTOR',
      branches: [
        {
          name: 'initial_branch',
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
    };
    render(<BehaviorTreeEditor tree={utilityTree} onChange={onChange} />);

    const addBranchBtn = screen.getByText(/\+ Add Utility Branch/i);
    fireEvent.click(addBranchBtn);

    const updatedTree = onChange.mock.calls[0][0];
    expect(BehaviorTreeNodeSchema.safeParse(updatedTree).success).toBe(true);
    expect(updatedTree.branches.length).toBe(2);
    expect(updatedTree.branches[1].considerations.length).toBeGreaterThanOrEqual(1);
  });
});
