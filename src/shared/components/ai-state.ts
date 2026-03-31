import { z } from 'zod';
import { defineComponent, ComponentData } from '@engine/ecs/types';

export enum AIBehavior {
  IDLE = 'idle',
  CHASING = 'chasing',
  ATTACKING = 'attacking'
}

export enum AIBehaviorType {
  BASIC = 'basic',
  NULL_POINTER = 'null_pointer',
  BUFFER_OVERFLOW = 'buffer_overflow',
  FRAGMENTER = 'fragmenter',
  LOGIC_LEAKER = 'logic_leaker',
  SYSTEM_ADMIN = 'system_admin',
  SEED_EATER = 'seed_eater'
}

/**
 * Component for enemy behavior state and parameters.
 */
export const AIState = defineComponent('aiState', z.object({
  behavior: z.nativeEnum(AIBehavior).default(AIBehavior.IDLE),
  behaviorType: z.nativeEnum(AIBehaviorType).default(AIBehaviorType.BASIC),
  sightRadius: z.number().int().positive().default(6),
}));

export type AIStateData = ComponentData<typeof AIState>;
