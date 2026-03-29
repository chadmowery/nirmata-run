import { z } from 'zod';
import { defineComponent } from '@engine/ecs/types';

/**
 * Component representing a Shell's base stats.
 */
export const Shell = defineComponent(
  'shell',
  z.object({
    speed: z.number().int().positive(),
    stability: z.number().int().min(0),
    armor: z.number().int().min(0),
    maxHealth: z.number().int().positive(),
  }),
);

/**
 * Type-safe data for the Shell component.
 */
export type ShellData = z.infer<typeof Shell.schema>;
