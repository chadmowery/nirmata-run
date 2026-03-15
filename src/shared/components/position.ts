import { z } from 'zod';
import { defineComponent } from '@engine/ecs/types';

/**
 * Component representing a 2D position on the grid.
 */
export const Position = defineComponent('position', z.object({
  x: z.number().int(),
  y: z.number().int(),
}));

/**
 * Type-safe data for the Position component.
 */
export type PositionData = z.infer<typeof Position.schema>;
