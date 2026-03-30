import { z } from 'zod';
import { defineComponent } from '@engine/ecs/types';

export interface ConditionNode {
  type: 'AND' | 'OR' | 'NOT' | 'ON_ACTIVATION' | 'ON_TARGET_HIT' | 'ON_OVERCLOCK' | 'ON_KILL' | 'HEAT_ABOVE' | 'HP_BELOW_PERCENT';
  conditions?: ConditionNode[];
  value?: number;
}

export const ConditionNodeSchema: z.ZodType<ConditionNode> = z.object({
  type: z.enum([
    'AND', 'OR', 'NOT',
    'ON_ACTIVATION', 'ON_TARGET_HIT', 'ON_OVERCLOCK', 'ON_KILL',
    'HEAT_ABOVE', 'HP_BELOW_PERCENT',
  ]),
  conditions: z.lazy(() => z.array(ConditionNodeSchema)).optional(),
  value: z.number().optional(),
});

export const PayloadSchema = z.object({
  type: z.enum(['HEAL', 'SHIELD', 'APPLY_STATUS', 'VENT_HEAT', 'DAMAGE_BONUS']),
  magnitude: z.number().optional(),
  statusEffectName: z.string().optional(),
  statusEffectDuration: z.number().int().min(1).optional(),
});

export const AugmentData = defineComponent('augmentData', z.object({
  name: z.string(),
  trigger: ConditionNodeSchema,
  payloads: z.array(PayloadSchema),
  maxTriggersPerTurn: z.number().int().min(1).default(99),
  cooldownTurns: z.number().int().min(0).default(0),
}));

export type AugmentDataType = z.infer<typeof AugmentData.schema>;
export type PayloadType = z.infer<typeof PayloadSchema>;
