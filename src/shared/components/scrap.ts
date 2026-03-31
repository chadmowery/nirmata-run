import { defineComponent } from '@engine/ecs/types';
import { z } from 'zod';

/**
 * Component representing the Scrap currency for an entity.
 */
export const Scrap = defineComponent('scrap', z.object({
  amount: z.number().int().min(0).default(0),
}));

/**
 * Type-safe data for the Scrap component.
 */
export type ScrapData = z.infer<typeof Scrap.schema>;
