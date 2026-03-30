import { z } from 'zod';
import { defineComponent } from '@engine/ecs/types';

/**
 * Runtime state for Augment activation tracking per entity.
 * Keys are augment entity IDs (as strings). Values are counts/turns.
 */
export const AugmentState = defineComponent('augmentState', z.object({
  /** Number of times each augment has activated this turn. Reset at turn start. */
  activationsThisTurn: z.record(z.string(), z.number()).default({}),
  /** Remaining cooldown turns for each augment. Decremented at turn start. */
  cooldownsRemaining: z.record(z.string(), z.number()).default({}),
}));

export type AugmentStateData = z.infer<typeof AugmentState.schema>;
