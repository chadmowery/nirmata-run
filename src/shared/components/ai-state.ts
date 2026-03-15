import { z } from 'zod';
import { defineComponent, ComponentData } from '@engine/ecs/types';

export enum AIBehavior {
  IDLE = 'idle',
  CHASING = 'chasing',
  ATTACKING = 'attacking'
}

/**
 * Component for enemy behavior state and parameters.
 */
export const AIState = defineComponent('aiState', z.object({
  behavior: z.nativeEnum(AIBehavior).default(AIBehavior.IDLE),
  sightRadius: z.number().int().positive().default(6),
}));

export type AIStateData = ComponentData<typeof AIState>;
