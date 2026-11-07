import { z } from 'zod';
import { defineComponent } from '@engine/ecs/types';

/**
 * Customizes one-shot sound cues for an entity (Shells, Enemies, Weapons, Props).
 */
export const AudioProfile = defineComponent(
  'audioProfile',
  z.object({
    stepCue: z.string().optional(),
    attackCue: z.string().optional(),
    hitCue: z.string().optional(),
    deathCue: z.string().optional(),
    interactCue: z.string().optional(),
    pitchMultiplier: z.number().min(0.25).max(4.0).default(1.0),
    volumeMultiplier: z.number().min(0.0).max(2.0).default(1.0),
  }),
);
export type AudioProfileData = z.infer<typeof AudioProfile.schema>;

/**
 * Attaches a continuous spatial audio loop to a world entity (e.g., Stability Anchor,
 * Cooling Vent, Corrupted Node, Null-Pointer, Seed_Eater).
 */
export const AmbientEmitter = defineComponent(
  'ambientEmitter',
  z.object({
    cueId: z.string(),
    radius: z.number().min(1).max(30).default(8),
    baseVolume: z.number().min(0).max(1).default(0.5),
    falloff: z.enum(['linear', 'inverse']).default('linear'),
    /** If true, emitter is muted when its tile is outside the player's active FOV */
    requiresFov: z.boolean().default(false),
    /** If true, emitter automatically stops once Prop.isSearched or CorruptedNode.isDisarmed is true */
    activeOnlyWhenUnsearched: z.boolean().default(false),
  }),
);
export type AmbientEmitterData = z.infer<typeof AmbientEmitter.schema>;
