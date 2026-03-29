import { z } from 'zod';
import { defineComponent } from '@engine/ecs/types';

/**
 * Component representing equipped software items.
 */
export const SoftwareSlots = defineComponent(
  'softwareSlots',
  z.object({
    equipped: z.array(z.number()),
  }),
);

/**
 * Type-safe data for the SoftwareSlots component.
 */
export type SoftwareSlotsData = z.infer<typeof SoftwareSlots.schema>;
