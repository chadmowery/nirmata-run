import { z } from 'zod';
import { defineComponent } from '@engine/ecs/types';

/**
 * Component representing a Shell's port configuration (maximum capacity for each slot type).
 */
export const PortConfig = defineComponent(
  'portConfig',
  z.object({
    maxFirmware: z.number().int().min(0),
    maxAugment: z.number().int().min(0),
    maxSoftware: z.number().int().min(0),
  }),
);

/**
 * Type-safe data for the PortConfig component.
 */
export type PortConfigData = z.infer<typeof PortConfig.schema>;
