import { z } from 'zod';
import { defineComponent } from '../../engine/ecs/types';

/**
 * Actor marker component to identify entities in the turn system.
 */
export const Actor = defineComponent('actor', z.object({
  /** True if this actor is the player. */
  isPlayer: z.boolean(),
}));

export type ActorData = z.infer<typeof Actor.schema>;
