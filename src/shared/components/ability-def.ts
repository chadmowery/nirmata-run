import { z } from 'zod';
import { defineComponent } from '@engine/ecs/types';

/**
 * Component defining the parameters of a Firmware ability.
 * These are usually attached to Firmware entities.
 */
export const AbilityDef = defineComponent(
  'abilityDef',
  z.object({
    /** Display name of the ability. */
    name: z.string(),
    /** Heat cost per activation. */
    heatCost: z.number().int().min(0),
    /** Maximum range (in tiles). 0 for self-targeted. */
    range: z.number().int().min(0),
    /** The fundamental behavior of this ability. */
    effectType: z.enum(['dash', 'ranged_attack', 'toggle_vision']),
    /** Damage dealt by 'ranged_attack'. */
    damageAmount: z.number().int().min(0).default(0),
    /** Distance moved by 'dash'. */
    dashDistance: z.number().int().min(0).default(0),
    /** Vision radius granted by 'toggle_vision'. */
    visionRadius: z.number().int().min(0).default(0),
    /** Heat cost per turn when active (for toggles). */
    heatPerTurn: z.number().int().min(0).default(0),
    /** Whether this ability can be toggled on/off. */
    isToggle: z.boolean().default(false),
    /** Current toggle state. */
    isActive: z.boolean().default(false),
    /** Whether this is a Legacy (non-upgradable) ability. */
    isLegacy: z.boolean().default(false),
  }),
);

/**
 * Type-safe data for the AbilityDef component.
 */
export type AbilityDefData = z.infer<typeof AbilityDef.schema>;
