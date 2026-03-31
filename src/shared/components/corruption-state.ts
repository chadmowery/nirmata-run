import { z } from 'zod';
import { defineComponent } from '@engine/ecs/types';

/**
 * Component for tracking corruption spread and subprocess spawning for Seed_Eater enemies.
 */
export const CorruptionState = defineComponent(
  'corruptionState',
  z.object({
    /** Current wave/radius of corruption spread. */
    corruptionWave: z.number().int().default(1),
    /** Keys of tiles already corrupted (format: "x,y"). */
    corruptedTileKeys: z.array(z.string()).default([]),
    /** Number of tiles to corrupt per turn. */
    tilesPerTurn: z.number().int().default(2),
    /** How often to spawn a sub-process (in turns). */
    spawnFrequency: z.number().int().default(3),
    /** Turns elapsed since last sub-process spawn. */
    turnsSinceLastSpawn: z.number().int().default(0),
  }),
);

/**
 * Type-safe data for the CorruptionState component.
 */
export type CorruptionStateData = z.infer<typeof CorruptionState.schema>;
