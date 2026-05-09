import { z } from 'zod';
import { defineComponent } from '@engine/ecs/types';

/**
 * Tag component indicating an entity has moved during the current turn.
 * Stores the movement delta for systems that need context.
 */
export const MovedThisTurn = defineComponent(
  'movedThisTurn',
  z.object({
    fromX: z.number(),
    fromY: z.number(),
    toX: z.number(),
    toY: z.number(),
  })
);

export type MovedThisTurnData = z.infer<typeof MovedThisTurn.schema>;
