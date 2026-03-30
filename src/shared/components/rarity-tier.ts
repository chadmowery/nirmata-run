import { z } from 'zod';
import { defineComponent } from '@engine/ecs/types';

/**
 * Constant mapping of rarity tiers to their scale factors.
 */
export const RARITY_SCALE_FACTORS = {
  'v0.x': 1.0,
  'v1.x': 1.5,
  'v2.x': 2.0,
  'v3.x': 3.0,
} as const;

/**
 * Component representing the rarity tier and scaling for software.
 */
export const RarityTier = defineComponent(
  'rarityTier',
  z.object({
    tier: z.enum(['v0.x', 'v1.x', 'v2.x', 'v3.x']),
    scaleFactor: z.number(),
    minFloor: z.number().int().min(0).default(0),
  }),
);

/**
 * Type-safe data for the RarityTier component.
 */
export type RarityTierData = z.infer<typeof RarityTier.schema>;
