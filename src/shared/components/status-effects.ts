import { z } from 'zod';
import { defineComponent } from '@engine/ecs/types';

/**
 * Component representing active status effects on an entity.
 */
export const StatusEffects = defineComponent(
  'statusEffects',
  z.object({
    effects: z.array(
      z.object({
        /** Unique name/identifier for the effect. */
        name: z.string(),
        /** Remaining duration in turns. */
        duration: z.number().int().min(0),
        /** Optional numerical value (e.g., strength of slow/debuff). */
        magnitude: z.number().default(0),
        /** Optional source entity ID or name. */
        source: z.string().optional(),
      }),
    ),
  }),
);

/**
 * Type-safe data for the StatusEffects component.
 */
export type StatusEffectsData = z.infer<typeof StatusEffects.schema>;
