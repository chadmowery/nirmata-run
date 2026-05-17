import { z } from 'zod';
import { defineComponent } from '@engine/ecs/types';

/**
 * Intent to swap inventory items.
 */
export const InventorySwapIntent = defineComponent(
  'inventorySwapIntent',
  z.object({
    actorId: z.number(),
    sourceIndex: z.number(),
    destinationIndex: z.number(),
  })
);
