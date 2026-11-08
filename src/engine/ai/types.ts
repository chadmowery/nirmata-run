/**
 * Engine AI Types & Execution Interfaces
 * Pure, zero-dependency types for Dijkstra maps and stateless Behavior Trees.
 */

export enum BTStatus {
  SUCCESS = 'SUCCESS',
  FAILURE = 'FAILURE',
}

export type ResponseCurveType = 'linear' | 'quadratic' | 'logistic' | 'step';

export interface ResponseCurveParams {
  curve: ResponseCurveType;
  /** Slope / exponent (default 1 for linear, 2 for quadratic). */
  slope?: number;
  /** Invert output (1 - y). */
  invert?: boolean;
  /** Min/Max clamping domain for raw input normalization. */
  minInput?: number;
  maxInput?: number;
}

export interface BTEvaluationContext<TNode, TCondition, TAction, TConsideration> {
  /** Evaluates a leaf condition predicate against the ECS world. */
  evaluateCondition(cond: TCondition): boolean;
  /** Executes a leaf action (attaching ECS Intent components) and returns SUCCESS/FAILURE. */
  executeAction(action: TAction): BTStatus;
  /** Resolves a named reusable subtree by ID. */
  resolveSubtree(subtreeId: string): TNode | undefined;
  /** Reads a raw numeric metric for Utility AI considerations. */
  getConsiderationInput(metric: TConsideration): number;
  /** Checks whether a named cooldown timer is ready (0 turns remaining). */
  isCooldownReady(cooldownId: string): boolean;
  /** Starts/resets a named cooldown timer on the entity's blackboard when child succeeds. */
  startCooldown(cooldownId: string, turns: number): void;
  /** Deterministic PRNG in [0, 1) for random selectors/decorators. */
  random(): number;
  /** Optional telemetry trace recorder for dev inspection and debugging. */
  recordTrace?: (step: string) => void;
}

export type BTNode<TCondition = unknown, TAction = unknown, TConsideration = unknown> =
  | { type: 'SELECTOR'; name?: string; children: BTNode<TCondition, TAction, TConsideration>[] }
  | { type: 'SEQUENCE'; name?: string; children: BTNode<TCondition, TAction, TConsideration>[] }
  | {
      type: 'UTILITY_SELECTOR';
      name?: string;
      branches: Array<{
        name: string;
        weight?: number;
        considerations: Array<{ metric: TConsideration } & ResponseCurveParams>;
        child: BTNode<TCondition, TAction, TConsideration>;
      }>;
    }
  | {
      type: 'DECORATOR_COOLDOWN';
      cooldownId: string;
      turns: number;
      child: BTNode<TCondition, TAction, TConsideration>;
    }
  | {
      type: 'DECORATOR_INVERT';
      child: BTNode<TCondition, TAction, TConsideration>;
    }
  | {
      type: 'DECORATOR_CHANCE';
      probability: number;
      child: BTNode<TCondition, TAction, TConsideration>;
    }
  | {
      type: 'SUBTREE';
      ref: string;
    }
  | {
      type: 'CONDITION';
      condition: TCondition;
    }
  | {
      type: 'ACTION';
      task: TAction;
    };
