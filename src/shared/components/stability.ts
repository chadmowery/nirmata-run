import { defineComponent } from '@engine/ecs/types';
import { z } from 'zod';

/**
 * Component representing the Reality Stability of an entity.
 * Per D-10, stability starts at 100%.
 */
export const Stability = defineComponent('stability', z.object({
  current: z.number().min(0).max(100),
  max: z.number().min(0).default(100),
}));

/**
 * Type-safe data for the Stability component.
 */
export type StabilityData = z.infer<typeof Stability.schema>;
