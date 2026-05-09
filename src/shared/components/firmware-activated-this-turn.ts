import { z } from 'zod';
import { defineComponent } from '@engine/ecs/types';

/**
 * Tag component indicating an entity has activated firmware during the current turn.
 */
export const FirmwareActivatedThisTurn = defineComponent(
  'firmwareActivatedThisTurn',
  z.object({
    slotIndex: z.number(),
  }),
);

export type FirmwareActivatedThisTurnData = z.infer<typeof FirmwareActivatedThisTurn.schema>;
