import { z } from 'zod';
import { defineComponent } from '@engine/ecs/types';

/**
 * Schema for a single software item in the run inventory.
 */
export const RunInventoryItemSchema = z.object({
  entityId: z.number(),
  templateId: z.string(),
  rarityTier: z.string(),
  pickedUpAtFloor: z.number(),
  pickedUpAtTimestamp: z.number(),
  gridIndex: z.number().optional(),
});

/**
 * Schema for a currency stack in the run inventory.
 */
export const CurrencyStackSchema = z.object({
  currencyType: z.enum(['scrap', 'blueprint', 'flux']),
  amount: z.number().int().min(0),
  blueprintId: z.string().optional(),
  blueprintType: z.enum(['firmware', 'augment']).optional(),
});

/**
 * Component representing the player's run-scoped software inventory.
 */
export const RunInventory = defineComponent('run_inventory', z.object({
  maxSlots: z.number().int().default(5),
  software: z.array(RunInventoryItemSchema).default([]),
  equipment: z.array(RunInventoryItemSchema).default([]),
}));

/**
 * Component representing the player's run-scoped currency stacks.
 */
export const RunCurrency = defineComponent('run_currency', z.object({
  stacks: z.array(CurrencyStackSchema).default([]),
}));

export type RunInventoryData = z.infer<typeof RunInventory.schema>;
export type RunCurrencyData = z.infer<typeof RunCurrency.schema>;
export type RunInventoryItem = z.infer<typeof RunInventoryItemSchema>;
export type CurrencyStack = z.infer<typeof CurrencyStackSchema>;
