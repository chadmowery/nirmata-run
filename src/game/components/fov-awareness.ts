import { z } from 'zod';
import { defineComponent, ComponentData } from '@engine/ecs/types';

/**
 * Component for tracking enemy awareness of the player.
 */
export const FovAwareness = defineComponent('fovAwareness', z.object({
  canSeePlayer: z.boolean().default(false),
  lastKnownPlayerX: z.number().int().optional(),
  lastKnownPlayerY: z.number().int().optional(),
}));

export type FovAwarenessData = ComponentData<typeof FovAwareness>;
