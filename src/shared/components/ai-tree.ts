import { z } from 'zod';

/**
 * 1. Leaf Condition Predicates
 */
export const AIConditionSchema = z.discriminatedUnion('check', [
  z.object({ check: z.literal('CAN_SEE_TARGET') }),
  z.object({ check: z.literal('HAS_LAST_KNOWN_TARGET_POS') }),
  z.object({ check: z.literal('IS_ALERTED') }),
  z.object({
    check: z.literal('TARGET_DISTANCE_LTE'),
    distance: z.number().int().min(0),
    metric: z.enum(['manhattan', 'chebyshev']).default('manhattan'),
  }),
  z.object({
    check: z.literal('TARGET_DISTANCE_GTE'),
    distance: z.number().int().min(0),
    metric: z.enum(['manhattan', 'chebyshev']).default('manhattan'),
  }),
  z.object({
    check: z.literal('TARGET_DISTANCE_BETWEEN'),
    min: z.number().int().min(0),
    max: z.number().int().min(0),
    metric: z.enum(['manhattan', 'chebyshev']).default('manhattan'),
  }),
  z.object({
    check: z.literal('SELF_HP_BELOW_PERCENT'),
    percent: z.number().min(0).max(100),
  }),
  z.object({
    check: z.literal('HAS_STATUS_EFFECT'),
    target: z.enum(['self', 'target']).default('self'),
    statusName: z.string(),
  }),
  z.object({
    check: z.literal('IS_PACK_LEADER'),
  }),
  z.object({
    check: z.literal('PACK_MEMBERS_ADJACENT_GTE'),
    count: z.number().int().min(1),
  }),
  z.object({
    check: z.literal('IN_DIRECTIONAL_COVER_FROM_TARGET'),
  }),
  z.object({
    check: z.literal('HAS_VALID_TELEPORT_AMBUSH_TILE'),
    minRange: z.number().int().default(2),
    maxRange: z.number().int().default(8),
  }),
]);

export type AICondition = z.infer<typeof AIConditionSchema>;

/**
 * 2. Leaf Action Descriptors (Each maps to 1 atomic ECS Intent in Phase.GATHER_INTENT)
 */
export const AIActionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('WAIT'),
    message: z.string().optional(),
  }),
  z.object({
    action: z.literal('MELEE_BUMP_TARGET'),
  }),
  z.object({
    action: z.literal('RANGED_ATTACK_TARGET'),
    statusEffect: z
      .object({
        name: z.string(),
        duration: z.number().int().min(1),
        magnitude: z.number().default(1),
      })
      .optional(),
    combatMessage: z.string().optional(),
  }),
  z.object({
    action: z.literal('MOVE_DIJKSTRA'),
    mapType: z.enum([
      'approach_target',
      'flee_from_target',
      'kite_to_cover',
      'pack_surround_cardinal',
      'investigate_last_known',
      'scavenge_nearest_loot',
      'patrol_anchors',
    ]),
    optimalRangeMin: z.number().int().optional(),
    optimalRangeMax: z.number().int().optional(),
    avoidHazards: z.boolean().default(true),
    canCrushProps: z.boolean().default(false),
    combatMessage: z.string().optional(),
  }),
  z.object({
    action: z.literal('TELEPORT_AMBUSH_BEHIND_TARGET'),
    minRange: z.number().int().default(2),
    maxRange: z.number().int().default(8),
    searchRadius: z.number().int().default(3),
    combatMessage: z.string().optional(),
  }),
  z.object({
    action: z.literal('SPAWN_ENTITIES_AROUND_SELF'),
    templateName: z.string(),
    pattern: z.enum(['cardinal_4', 'ring_radius_3']),
    count: z.number().int().min(1).default(4),
    deadZoneConfig: z
      .object({
        remainingTurns: z.number().int().min(1),
        damagePerTick: z.number().int().min(1),
      })
      .optional(),
    combatMessage: z.string().optional(),
  }),
]);

export type AIAction = z.infer<typeof AIActionSchema>;

/**
 * 3. Utility Consideration Schema (for UTILITY_SELECTOR motivation scoring)
 */
export const UtilityConsiderationSchema = z.object({
  metric: z.enum([
    'self_hp_ratio',
    'target_distance',
    'target_visible',
    'pack_adjacent_count',
    'nearby_loot_value',
    'in_cover',
  ]),
  curve: z.enum(['linear', 'quadratic', 'logistic', 'step']).default('linear'),
  slope: z.number().default(1),
  invert: z.boolean().default(false),
  minInput: z.number().default(0),
  maxInput: z.number().default(1),
});

export type UtilityConsideration = z.infer<typeof UtilityConsiderationSchema>;

/**
 * 4. Recursive Behavior Tree AST Schema
 */
export type BehaviorTreeNode =
  | { type: 'SELECTOR'; name?: string; children: BehaviorTreeNode[] }
  | { type: 'SEQUENCE'; name?: string; children: BehaviorTreeNode[] }
  | {
      type: 'UTILITY_SELECTOR';
      name?: string;
      branches: Array<{
        name: string;
        weight?: number;
        considerations: z.infer<typeof UtilityConsiderationSchema>[];
        child: BehaviorTreeNode;
      }>;
    }
  | {
      type: 'DECORATOR_COOLDOWN';
      cooldownId: string;
      turns: number;
      child: BehaviorTreeNode;
    }
  | {
      type: 'DECORATOR_INVERT';
      child: BehaviorTreeNode;
    }
  | {
      type: 'DECORATOR_CHANCE';
      probability: number;
      child: BehaviorTreeNode;
    }
  | {
      type: 'SUBTREE';
      ref: string;
    }
  | {
      type: 'CONDITION';
      condition: z.infer<typeof AIConditionSchema>;
    }
  | {
      type: 'ACTION';
      task: z.infer<typeof AIActionSchema>;
    };

export const BehaviorTreeNodeSchema: z.ZodType<BehaviorTreeNode> = z.lazy(() =>
  z.discriminatedUnion('type', [
    z.object({
      type: z.literal('SELECTOR'),
      name: z.string().optional(),
      children: z.array(BehaviorTreeNodeSchema).min(1),
    }),
    z.object({
      type: z.literal('SEQUENCE'),
      name: z.string().optional(),
      children: z.array(BehaviorTreeNodeSchema).min(1),
    }),
    z.object({
      type: z.literal('UTILITY_SELECTOR'),
      name: z.string().optional(),
      branches: z
        .array(
          z.object({
            name: z.string(),
            weight: z.number().positive().default(1.0),
            considerations: z.array(UtilityConsiderationSchema).min(1),
            child: BehaviorTreeNodeSchema,
          }),
        )
        .min(1),
    }),
    z.object({
      type: z.literal('DECORATOR_COOLDOWN'),
      cooldownId: z.string(),
      turns: z.number().int().min(1),
      child: BehaviorTreeNodeSchema,
    }),
    z.object({
      type: z.literal('DECORATOR_INVERT'),
      child: BehaviorTreeNodeSchema,
    }),
    z.object({
      type: z.literal('DECORATOR_CHANCE'),
      probability: z.number().min(0).max(1),
      child: BehaviorTreeNodeSchema,
    }),
    z.object({
      type: z.literal('SUBTREE'),
      ref: z.string(),
    }),
    z.object({
      type: z.literal('CONDITION'),
      condition: AIConditionSchema,
    }),
    z.object({
      type: z.literal('ACTION'),
      task: AIActionSchema,
    }),
  ]),
);
