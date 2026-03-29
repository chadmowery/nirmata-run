import { z } from 'zod';
import { defineComponent } from '@engine/ecs/types';

/**
 * Component representing equipped augment items.
 */
export const AugmentSlots = defineComponent(
  'augmentSlots',
  z.object({
    equipped: z.array(z.number()),
  }),
);

/**
 * Type-safe data for the AugmentSlots component.
 */
export type AugmentSlotsData = z.infer<typeof AugmentSlots.schema>;
