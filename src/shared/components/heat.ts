import { z } from 'zod';
import { defineComponent } from '@engine/ecs/types';

/**
 * Component representing an entity's heat management resource.
 */
export const Heat = defineComponent(
  'heat',
  z.object({
    /** Current heat level. Starts at 0, increases with ability usage. */
    current: z.number().min(0).default(0),
    /** Heat threshold before Kernal Panic rolls begin. */
    maxSafe: z.number().int().positive().default(100),
    /** Base amount of heat dissipated per turn. */
    baseDissipation: z.number().positive().default(5),
    /** Percentage of heat removed when performing a Vent action (0.0 to 1.0). */
    ventPercentage: z.number().min(0).max(1).default(0.5),
    /** Whether the entity is currently in a "venting" state (defense penalty). */
    isVenting: z.boolean().default(false),
  }),
);

/**
 * Type-safe data for the Heat component.
 */
export type HeatData = z.infer<typeof Heat.schema>;
