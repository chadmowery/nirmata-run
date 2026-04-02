import { z } from 'zod';
import { defineComponent } from '@engine/ecs/types';

/**
 * Component representing an entity's loot table.
 */
export const LootTable = defineComponent('lootTable', z.object({
  tier: z.number().int().min(1).max(3).optional().default(1),
  drops: z.array(z.object({
    template: z.string(),
    chance: z.number().min(0).max(1),
  })),
}));

/**
 * Type-safe data for the LootTable component.
 */
export type LootTableData = z.infer<typeof LootTable.schema>;
