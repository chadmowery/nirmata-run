import { describe, it, expect, vi } from 'vitest';
import { StateMachine } from './state-machine';
import { StateConfig, TransitionTable } from './types';

type TestState = 'A' | 'B' | 'C';

describe('StateMachine', () => {
  const transitions: TransitionTable<TestState> = [
    ['A', 'B'],
    ['B', 'C'],
    ['C', 'A'],
  ];

  it('starts at the initial state', () => {
    const configs: Record<TestState, StateConfig<TestState>> = {
      A: {},
      B: {},
      C: {},
    };
    const fsm = new StateMachine<TestState>('A', configs, transitions, undefined);
    expect(fsm.getCurrentState()).toBe('A');
  });

  it('transitions successfully and returns true for valid transitions', () => {
    const configs: Record<TestState, StateConfig<TestState>> = {
      A: {},
      B: {},
      C: {},
    };
    const fsm = new StateMachine<TestState>('A', configs, transitions, undefined);
    const result = fsm.transition('B');
    expect(result).toBe(true);
    expect(fsm.getCurrentState()).toBe('B');
  });

  it('fails and returns false for invalid transitions', () => {
    const configs: Record<TestState, StateConfig<TestState>> = {
      A: {},
      B: {},
      C: {},
    };
    const fsm = new StateMachine<TestState>('A', configs, transitions, undefined);
    const result = fsm.transition('C');
    expect(result).toBe(false);
    expect(fsm.getCurrentState()).toBe('A');
  });

  it('calls onExit and onEnter hooks with context', () => {
    const context = { value: 0 };
    const onEnterB = vi.fn();
    const onExitA = vi.fn();

    const configs: Record<TestState, StateConfig<TestState, typeof context>> = {
      A: { onExit: onExitA },
      B: { onEnter: onEnterB },
      C: {},
    };

    const fsm = new StateMachine<TestState, typeof context>('A', configs, transitions, context);
    fsm.transition('B');

    expect(onExitA).toHaveBeenCalledWith(context);
    expect(onEnterB).toHaveBeenCalledWith(context);
  });

  it('calls hooks in the correct order (exit then enter)', () => {
    const callOrder: string[] = [];
    const configs: Record<TestState, StateConfig<TestState>> = {
      A: { onExit: () => callOrder.push('exitA') },
      B: { onEnter: () => callOrder.push('enterB') },
      C: {},
    };

    const fsm = new StateMachine<TestState>('A', configs, transitions, undefined);
    fsm.transition('B');

    expect(callOrder).toEqual(['exitA', 'enterB']);
  });

  it('correctly reports canTransitionTo', () => {
    const configs: Record<TestState, StateConfig<TestState>> = {
      A: {},
      B: {},
      C: {},
    };
    const fsm = new StateMachine<TestState>('A', configs, transitions, undefined);
    expect(fsm.canTransitionTo('B')).toBe(true);
    expect(fsm.canTransitionTo('C')).toBe(false);
  });

  it('supports updating context', () => {
    const context1 = { val: 1 };
    const context2 = { val: 2 };
    const onEnterB = vi.fn();

    const configs: Record<TestState, StateConfig<TestState, { val: number }>> = {
      A: {},
      B: { onEnter: onEnterB },
      C: {},
    };

    const fsm = new StateMachine<TestState, { val: number }>('A', configs, transitions, context1);
    fsm.setContext(context2);
    fsm.transition('B');

    expect(onEnterB).toHaveBeenCalledWith(context2);
  });
});
