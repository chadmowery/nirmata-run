import { z } from 'zod';
import { defineComponent } from '@engine/ecs/types';

/**
 * Component representing an entity's defense/armor.
 */
export const Defense = defineComponent('defense', z.object({
  armor: z.number().int().min(0),
}));

/**
 * Type-safe data for the Defense component.
 */
export type DefenseData = z.infer<typeof Defense.schema>;
