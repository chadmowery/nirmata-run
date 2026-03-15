import { z } from 'zod';
import { defineComponent } from '@engine/ecs/types';

/**
 * Component representing an entity's progression (XP and Level).
 */
export const Progression = defineComponent('progression', z.object({
  xp: z.number().int().min(0).default(0),
  level: z.number().int().positive().default(1),
}));

/**
 * Type-safe data for the Progression component.
 */
export type ProgressionData = z.infer<typeof Progression.schema>;
