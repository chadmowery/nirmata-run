import { z } from 'zod';
import { defineComponent } from '@engine/ecs/types';

/**
 * Component representing an entity's attack power.
 */
export const Attack = defineComponent('attack', z.object({
  power: z.number().int().positive(),
}));

/**
 * Type-safe data for the Attack component.
 */
export type AttackData = z.infer<typeof Attack.schema>;
