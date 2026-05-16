import { z } from 'zod';
import { defineComponent } from '@engine/ecs/types';

/**
 * Component tracking which equipment entity IDs are active in slots.
 */
export const EquipmentSlots = defineComponent(
  'equipmentSlots',
  z.object({
    weapon: z.number().nullable().default(null),
    armor: z.number().nullable().default(null),
  }),
);

/**
 * Type-safe data for the EquipmentSlots component.
 */
export type EquipmentSlotsData = z.infer<typeof EquipmentSlots.schema>;
