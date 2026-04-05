import { z } from 'zod';
import { defineComponent } from '@engine/ecs/types';

/**
 * Component representing an entity's health.
 */
export const Health = defineComponent('health', z.object({
  current: z.number().int().min(0),
  max: z.number().int().positive(),
  isAlive: z.boolean().default(true),
}));

/**
 * Type-safe data for the Health component.
 */
export type HealthData = z.infer<typeof Health.schema>;
