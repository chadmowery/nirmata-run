import { z } from 'zod';
import { defineComponent } from '@engine/ecs/types';

/**
 * Component representing equipped firmware items.
 */
export const FirmwareSlots = defineComponent(
  'firmwareSlots',
  z.object({
    equipped: z.array(z.number()),
  }),
);

/**
 * Type-safe data for the FirmwareSlots component.
 */
export type FirmwareSlotsData = z.infer<typeof FirmwareSlots.schema>;
