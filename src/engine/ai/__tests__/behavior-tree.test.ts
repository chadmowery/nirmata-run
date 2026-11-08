import { describe, it, expect, vi } from 'vitest';
import {
  evaluateCurve,
  evaluateBehaviorTree,
  evaluateUtilityBranchScore,
} from '../behavior-tree';
import { BTStatus, BTEvaluationContext, BTNode } from '../types';

describe('Behavior Tree & Utility AI Engine Primitives', () => {
  describe('evaluateCurve', () => {
    it('evaluates linear curve correctly within min/max bounds', () => {
      expect(evaluateCurve(0, { curve: 'linear', minInput: 0, maxInput: 10 })).toBe(0);
      expect(evaluateCurve(5, { curve: 'linear', minInput: 0, maxInput: 10 })).toBe(0.5);
      expect(evaluateCurve(10, { curve: 'linear', minInput: 0, maxInput: 10 })).toBe(1);
      expect(evaluateCurve(-5, { curve: 'linear', minInput: 0, maxInput: 10 })).toBe(0);
      expect(evaluateCurve(15, { curve: 'linear', minInput: 0, maxInput: 10 })).toBe(1);
    });

    it('evaluates quadratic curve with slope', () => {
      // slope = 2 => t^2
      expect(evaluateCurve(0.5, { curve: 'quadratic', slope: 2, minInput: 0, maxInput: 1 })).toBe(0.25);
    });

    it('evaluates step curve', () => {
      expect(evaluateCurve(0.4, { curve: 'step', slope: 0.5, minInput: 0, maxInput: 1 })).toBe(0);
      expect(evaluateCurve(0.6, { curve: 'step', slope: 0.5, minInput: 0, maxInput: 1 })).toBe(1);
    });

    it('supports inverted curves', () => {
      expect(evaluateCurve(0.2, { curve: 'linear', invert: true, minInput: 0, maxInput: 1 })).toBeCloseTo(0.8);
    });
  });

  describe('evaluateBehaviorTree', () => {
    function createMockContext(): BTEvaluationContext<
      BTNode<string, string, string>,
      string,
      string,
      string
    > {
      const cooldowns = new Map<string, number>();
      return {
        evaluateCondition: vi.fn((cond: string) => cond === 'pass'),
        executeAction: vi.fn((act: string) => (act === 'fail_act' ? BTStatus.FAILURE : BTStatus.SUCCESS)),
        resolveSubtree: vi.fn(),
        getConsiderationInput: vi.fn(() => 0.5),
        isCooldownReady: vi.fn((id: string) => (cooldowns.get(id) ?? 0) <= 0),
        startCooldown: vi.fn((id: string, turns: number) => {
          cooldowns.set(id, turns);
        }),
        random: vi.fn(() => 0.5),
      };
    }

    it('evaluates SEQUENCE: succeeds only when all children succeed', () => {
      const ctx = createMockContext();
      const node: BTNode<string, string, string> = {
        type: 'SEQUENCE',
        children: [
          { type: 'CONDITION', condition: 'pass' },
          { type: 'ACTION', task: 'do_action' },
        ],
      };

      expect(evaluateBehaviorTree(node, ctx)).toBe(BTStatus.SUCCESS);
      expect(ctx.evaluateCondition).toHaveBeenCalledWith('pass');
      expect(ctx.executeAction).toHaveBeenCalledWith('do_action');

      // Failure short-circuit
      const failNode: BTNode<string, string, string> = {
        type: 'SEQUENCE',
        children: [
          { type: 'CONDITION', condition: 'fail' },
          { type: 'ACTION', task: 'do_action' },
        ],
      };
      const ctx2 = createMockContext();
      expect(evaluateBehaviorTree(failNode, ctx2)).toBe(BTStatus.FAILURE);
      expect(ctx2.executeAction).not.toHaveBeenCalled();
    });

    it('evaluates SELECTOR: succeeds as soon as one child succeeds', () => {
      const ctx = createMockContext();
      const node: BTNode<string, string, string> = {
        type: 'SELECTOR',
        children: [
          { type: 'CONDITION', condition: 'fail' },
          { type: 'ACTION', task: 'do_action' },
        ],
      };

      expect(evaluateBehaviorTree(node, ctx)).toBe(BTStatus.SUCCESS);
      expect(ctx.executeAction).toHaveBeenCalledWith('do_action');
    });

    it('evaluates DECORATOR_COOLDOWN: gates execution and resets cooldown on child success', () => {
      const ctx = createMockContext();
      const node: BTNode<string, string, string> = {
        type: 'DECORATOR_COOLDOWN',
        cooldownId: 'blink',
        turns: 3,
        child: { type: 'ACTION', task: 'teleport' },
      };

      // 1. First execution: ready
      expect(evaluateBehaviorTree(node, ctx)).toBe(BTStatus.SUCCESS);
      expect(ctx.startCooldown).toHaveBeenCalledWith('blink', 3);

      // 2. Second execution: cooldown not ready
      vi.mocked(ctx.isCooldownReady).mockReturnValue(false);
      expect(evaluateBehaviorTree(node, ctx)).toBe(BTStatus.FAILURE);
    });

    it('evaluates DECORATOR_INVERT: inverts child result', () => {
      const ctx = createMockContext();
      const invertSuccess: BTNode<string, string, string> = {
        type: 'DECORATOR_INVERT',
        child: { type: 'CONDITION', condition: 'pass' },
      };
      expect(evaluateBehaviorTree(invertSuccess, ctx)).toBe(BTStatus.FAILURE);

      const invertFailure: BTNode<string, string, string> = {
        type: 'DECORATOR_INVERT',
        child: { type: 'CONDITION', condition: 'fail' },
      };
      expect(evaluateBehaviorTree(invertFailure, ctx)).toBe(BTStatus.SUCCESS);
    });

    it('evaluates DECORATOR_CHANCE: evaluates child if random < probability', () => {
      const ctx = createMockContext();
      vi.mocked(ctx.random).mockReturnValue(0.25);

      const node: BTNode<string, string, string> = {
        type: 'DECORATOR_CHANCE',
        probability: 0.5,
        child: { type: 'ACTION', task: 'do_it' },
      };
      expect(evaluateBehaviorTree(node, ctx)).toBe(BTStatus.SUCCESS);

      // Roll above probability
      vi.mocked(ctx.random).mockReturnValue(0.75);
      expect(evaluateBehaviorTree(node, ctx)).toBe(BTStatus.FAILURE);
    });

    it('evaluates SUBTREE: resolves and evaluates child subtree', () => {
      const ctx = createMockContext();
      const subChild: BTNode<string, string, string> = {
        type: 'ACTION',
        task: 'sub_action',
      };
      vi.mocked(ctx.resolveSubtree).mockReturnValue(subChild);

      const node: BTNode<string, string, string> = {
        type: 'SUBTREE',
        ref: 'my_sub',
      };

      expect(evaluateBehaviorTree(node, ctx)).toBe(BTStatus.SUCCESS);
      expect(ctx.resolveSubtree).toHaveBeenCalledWith('my_sub');
      expect(ctx.executeAction).toHaveBeenCalledWith('sub_action');
    });

    it('evaluates UTILITY_SELECTOR: sorts branches by geometric mean motivation score', () => {
      const ctx = createMockContext();
      // metric 'hp' returns 0.9, metric 'dist' returns 0.2
      vi.mocked(ctx.getConsiderationInput).mockImplementation((m: string) => {
        if (m === 'hp') return 0.9;
        if (m === 'dist') return 0.2;
        return 0.5;
      });

      const branchActionA = vi.fn(() => BTStatus.SUCCESS);
      const branchActionB = vi.fn(() => BTStatus.SUCCESS);

      const node: BTNode<string, string, string> = {
        type: 'UTILITY_SELECTOR',
        branches: [
          {
            name: 'low_priority',
            weight: 1.0,
            considerations: [{ metric: 'dist', curve: 'linear' }],
            child: {
              type: 'ACTION',
              task: 'action_b',
            },
          },
          {
            name: 'high_priority',
            weight: 1.0,
            considerations: [{ metric: 'hp', curve: 'linear' }],
            child: {
              type: 'ACTION',
              task: 'action_a',
            },
          },
        ],
      };

      vi.mocked(ctx.executeAction).mockImplementation((task: string) => {
        if (task === 'action_a') return branchActionA();
        if (task === 'action_b') return branchActionB();
        return BTStatus.FAILURE;
      });

      const result = evaluateBehaviorTree(node, ctx);
      expect(result).toBe(BTStatus.SUCCESS);
      // high_priority should be executed first because hp (0.9) > dist (0.2)
      expect(branchActionA).toHaveBeenCalled();
      expect(branchActionB).not.toHaveBeenCalled();
    });
  });
});
