import { z } from 'zod';
import { defineComponent } from '@engine/ecs/types';

/**
 * Component representing core data for a software item.
 */
export const SoftwareDef = defineComponent(
  'softwareDef',
  z.object({
    name: z.string(), // display name (e.g., "Bleed.exe")
    type: z.string(), // canonical type ID (e.g., "bleed", "auto-loader", "vampire")
    targetSlot: z.enum(['weapon', 'armor']), // offensive burns to weapon, defensive to armor
    baseMagnitude: z.number(), // base effect value before rarity scaling
    effectType: z.enum(['dot', 'action_economy', 'heal_on_kill']), // discriminator for effect resolution
    description: z.string(), // flavor text
    purchaseCost: z.number().int().min(0).default(0), // Scrap cost, stubbed for Phase 13
  }),
);

/**
 * Type-safe data for the SoftwareDef component.
 */
export type SoftwareDefData = z.infer<typeof SoftwareDef.schema>;
