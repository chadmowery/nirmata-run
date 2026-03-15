import { z } from 'zod';
import { defineComponent } from '../../engine/ecs/types';

/**
 * Energy component for turn-based scheduling.
 * Actors accumulate energy based on speed.
 */
export const Energy = defineComponent('energy', z.object({
  /** Current energy accumulated. */
  current: z.number().int(),
  /** Rate of energy accumulation. */
  speed: z.number().int().positive(),
  /** Energy needed to take a turn. */
  threshold: z.number().int().positive().default(1000),
}));

export type EnergyData = z.infer<typeof Energy.schema>;
