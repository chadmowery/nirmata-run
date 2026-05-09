import { z } from 'zod';
import { defineComponent } from '@engine/ecs/types';

/**
 * Component tracking damage dealt by an entity during the current turn.
 */
export const DealtDamageThisTurn = defineComponent(
  'dealtDamageThisTurn',
  z.object({
    amount: z.number().default(0),
  }),
);

export type DealtDamageThisTurnData = z.infer<typeof DealtDamageThisTurn.schema>;
