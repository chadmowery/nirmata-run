import { z } from 'zod';
import { defineComponent } from '@engine/ecs/types';

/**
 * Component tracking which software entities are burned onto equipment slots.
 */
export const BurnedSoftware = defineComponent(
  'burnedSoftware',
  z.object({
    weapon: z.number().nullable().default(null), // entity ID of software burned onto weapon slot
    armor: z.number().nullable().default(null), // entity ID of software burned onto armor slot
  }),
);

/**
 * Type-safe data for the BurnedSoftware component.
 */
export type BurnedSoftwareData = z.infer<typeof BurnedSoftware.schema>;
