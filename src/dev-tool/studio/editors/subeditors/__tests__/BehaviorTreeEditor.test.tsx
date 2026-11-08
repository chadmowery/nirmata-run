import React from 'react';
import '@testing-library/jest-dom';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BehaviorTreeEditor } from '../BehaviorTreeEditor';
import type { BehaviorTreeNode } from '@/shared/components/ai-tree';

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
});
