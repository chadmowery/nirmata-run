/**
 * Stateless Behavior Tree & Utility AI Evaluator
 * Pure, turn-based "Tick-to-Intent" engine runner.
 */

import { BTStatus, ResponseCurveParams, BTEvaluationContext, BTNode } from './types';

const MAX_BT_DEPTH = 64;

/**
 * Normalizes and maps a raw numerical input through a response curve into [0, 1].
 */
export function evaluateCurve(rawValue: number, params: ResponseCurveParams): number {
  const min = params.minInput ?? 0;
  const max = params.maxInput ?? 1;

  let t = 0;
  if (max > min) {
    t = Math.max(0, Math.min(1, (rawValue - min) / (max - min)));
  } else if (rawValue >= max) {
    t = 1;
  }

  let y: number;
  switch (params.curve) {
    case 'linear':
      y = t;
      break;
    case 'quadratic': {
      const slope = params.slope ?? 2;
      y = Math.pow(t, slope);
      break;
    }
    case 'logistic': {
      const slope = params.slope ?? 1;
      y = 1 / (1 + Math.exp(-10 * slope * (t - 0.5)));
      break;
    }
    case 'step': {
      const threshold = params.slope ?? 0.5;
      y = t >= threshold ? 1 : 0;
      break;
    }
    default:
      y = t;
      break;
  }

  if (params.invert) {
    y = 1 - y;
  }

  return Math.max(0, Math.min(1, Number.isFinite(y) ? y : 0));
}

/**
 * Computes the Utility AI motivation score for a branch using Dave Mark's IAUS
 * geometric mean compensation factor across multiple considerations.
 */
export function evaluateUtilityBranchScore<TCondition, TAction, TConsideration>(
  branch: {
    weight?: number;
    considerations: Array<{ metric: TConsideration } & ResponseCurveParams>;
  },
  ctx: BTEvaluationContext<
    BTNode<TCondition, TAction, TConsideration>,
    TCondition,
    TAction,
    TConsideration
  >,
): number {
  const weight = branch.weight ?? 1.0;
  if (branch.considerations.length === 0) {
    return weight;
  }

  let product = 1;
  for (const consideration of branch.considerations) {
    const rawInput = ctx.getConsiderationInput(consideration.metric);
    const score = evaluateCurve(rawInput, consideration);
    product *= score;
    if (product <= 0) {
      return 0;
    }
  }

  const geometricMean = Math.pow(product, 1 / branch.considerations.length);
  return weight * geometricMean;
}

/**
 * Statelessly evaluates a Behavior Tree AST from root to leaf for the current acting entity.
 * Returns BTStatus.SUCCESS if an action was executed or wait chosen; BTStatus.FAILURE otherwise.
 */
export function evaluateBehaviorTree<TCondition, TAction, TConsideration>(
  node: BTNode<TCondition, TAction, TConsideration>,
  ctx: BTEvaluationContext<
    BTNode<TCondition, TAction, TConsideration>,
    TCondition,
    TAction,
    TConsideration
  >,
  depth: number = 0,
): BTStatus {
  if (depth > MAX_BT_DEPTH) {
    return BTStatus.FAILURE;
  }

  switch (node.type) {
    case 'SELECTOR': {
      if (node.name) ctx.recordTrace?.(node.name);
      for (const child of node.children) {
        const status = evaluateBehaviorTree(child, ctx, depth + 1);
        if (status === BTStatus.SUCCESS) {
          return BTStatus.SUCCESS;
        }
      }
      return BTStatus.FAILURE;
    }

    case 'SEQUENCE': {
      if (node.name) ctx.recordTrace?.(node.name);
      for (const child of node.children) {
        const status = evaluateBehaviorTree(child, ctx, depth + 1);
        if (status === BTStatus.FAILURE) {
          return BTStatus.FAILURE;
        }
      }
      return BTStatus.SUCCESS;
    }

    case 'UTILITY_SELECTOR': {
      const scoredBranches = node.branches.map((branch) => ({
        branch,
        score: evaluateUtilityBranchScore(branch, ctx),
      }));

      // Sort descending by motivation score
      scoredBranches.sort((a, b) => b.score - a.score);

      for (const { branch, score } of scoredBranches) {
        // If utility score is zero, skip unviable branches
        if (score <= 0) continue;

        const status = evaluateBehaviorTree(branch.child, ctx, depth + 1);
        if (status === BTStatus.SUCCESS) {
          return BTStatus.SUCCESS;
        }
      }
      return BTStatus.FAILURE;
    }

    case 'DECORATOR_COOLDOWN': {
      if (!ctx.isCooldownReady(node.cooldownId)) {
        return BTStatus.FAILURE;
      }
      const status = evaluateBehaviorTree(node.child, ctx, depth + 1);
      if (status === BTStatus.SUCCESS) {
        ctx.startCooldown(node.cooldownId, node.turns);
        return BTStatus.SUCCESS;
      }
      return BTStatus.FAILURE;
    }

    case 'DECORATOR_INVERT': {
      const status = evaluateBehaviorTree(node.child, ctx, depth + 1);
      return status === BTStatus.SUCCESS ? BTStatus.FAILURE : BTStatus.SUCCESS;
    }

    case 'DECORATOR_CHANCE': {
      const roll = ctx.random();
      if (roll < node.probability) {
        return evaluateBehaviorTree(node.child, ctx, depth + 1);
      }
      return BTStatus.FAILURE;
    }

    case 'SUBTREE': {
      const subtree = ctx.resolveSubtree(node.ref);
      if (!subtree) {
        return BTStatus.FAILURE;
      }
      return evaluateBehaviorTree(subtree, ctx, depth + 1);
    }

    case 'CONDITION': {
      const passed = ctx.evaluateCondition(node.condition);
      return passed ? BTStatus.SUCCESS : BTStatus.FAILURE;
    }

    case 'ACTION': {
      const status = ctx.executeAction(node.task);
      if (status === BTStatus.SUCCESS) {
        const actionName = (node.task as { action?: string })?.action || 'ACTION';
        ctx.recordTrace?.(`${actionName} [SUCCESS]`);
      }
      return status;
    }

    default:
      return BTStatus.FAILURE;
  }
}
