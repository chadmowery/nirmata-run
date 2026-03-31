import { z } from 'zod';
import { defineComponent } from '@engine/ecs/types';

/**
 * Component representing a Dead Zone tile.
 * Dead Zones deal damage over time to any entity standing on them.
 */
export const DeadZone = defineComponent(
  'deadZone',
  z.object({
    /** Remaining duration in turns before the Dead Zone expires. */
    remainingTurns: z.number().int().min(0),
    /** Damage dealt per turn to entities on this tile. */
    damagePerTick: z.number().default(2),
    /** Optional entity ID of the creator. */
    creatorId: z.number().optional(),
  }),
);

/**
 * Type-safe data for the DeadZone component.
 */
export type DeadZoneData = z.infer<typeof DeadZone.schema>;
