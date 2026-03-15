import { defineComponent } from '../../engine/ecs/types';
import { z } from 'zod';

/**
 * Marks an entity as a collectible item.
 */
export const Item = defineComponent(
  'item',
  z.object({
    name: z.string(),
    description: z.string().optional(),
  })
);

export type ItemData = z.infer<typeof Item.schema>;
