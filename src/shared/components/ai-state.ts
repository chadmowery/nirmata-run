import { z } from 'zod';
import { defineComponent, ComponentData } from '@engine/ecs/types';
import { BehaviorTreeNodeSchema } from './ai-tree';

export enum AIBehavior {
  IDLE = 'idle',
  CHASING = 'chasing',
  ATTACKING = 'attacking',
}

export enum AIBehaviorType {
  BASIC = 'basic',
  NULL_POINTER = 'null_pointer',
  BUFFER_OVERFLOW = 'buffer_overflow',
  FRAGMENTER = 'fragmenter',
  LOGIC_LEAKER = 'logic_leaker',
  SYSTEM_ADMIN = 'system_admin',
  SEED_EATER = 'seed_eater',
}

/**
 * Component for enemy behavior state and parameters.
 */
export const AIState = defineComponent(
  'aiState',
  z.object({
    /** Client-visible high-level posture for HUD tooltips & shaders. */
    behavior: z.nativeEnum(AIBehavior).default(AIBehavior.IDLE),
    /** Legacy enum retained as fallback/alias for treeId during migration. */
    behaviorType: z.nativeEnum(AIBehaviorType).default(AIBehaviorType.BASIC),
    /** ID of the registered Behavior Tree in AIBehaviorRegistry (defaults to behaviorType). */
    treeId: z.string().optional(),
    /** Optional inline Behavior Tree override for bespoke one-off entities in /dev/gamedata. */
    inlineTree: BehaviorTreeNodeSchema.optional(),
    /** Visual FOV detection radius. */
    sightRadius: z.number().int().positive().default(6).optional(),
    /** How many turns the entity continues investigating lastKnownPlayerX/Y after losing LOS. */
    memoryTurns: z.number().int().min(0).default(5).optional(),
    /** Server-only cooldown counters (redacted from client deltas). */
    cooldowns: z.record(z.string(), z.number().int().min(0)).default({}).optional(),
    /** Server-only remaining memory turns before reverting from CHASING to IDLE. */
    remainingMemoryTurns: z.number().int().min(0).default(0).optional(),
    /** Last evaluated Behavior Tree path for debug telemetry (e.g. root > visible-engagement > blink-behind-player [SUCCESS]). */
    lastEvaluatedPath: z.string().optional(),
  }),
);

export type AIStateData = ComponentData<typeof AIState>;
