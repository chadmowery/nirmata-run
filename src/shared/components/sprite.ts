import { z } from 'zod';
import { defineComponent } from '../../engine/ecs/types';
import { AnimationStateKeySchema } from '../tileset-types';

/**
 * Component for entities that should be rendered with a sprite.
 */
export const SpriteComponent = defineComponent(
  'sprite',
  z.object({
    /** Canonical base frame key in `tileset.json#frames` (also used as default lookup key in `tileset.json#animations`). */
    key: z.string(),
    /** Optional explicit key in `tileset.json#animations` if different from `key`. */
    animationSet: z.string().optional(),
    /** Optional initial animation state override (defaults to component-derived ambient state, typically 'idle'). */
    initialState: AnimationStateKeySchema.optional(),
    /** Optional playback speed multiplier (e.g. 1.25 for hasted/elite variants). */
    speedMultiplier: z.number().positive().default(1).optional(),
    /** When true, locks the sprite to Frame 0 of its current state. */
    paused: z.boolean().default(false).optional(),
    /** Whether to desynchronize loop phase using EntityId hash (defaults to true for non-player entities). */
    desyncPhase: z.boolean().optional(),
  }),
);

/**
 * Type-safe data for the Sprite component.
 */
export type SpriteComponentData = z.infer<typeof SpriteComponent.schema>;
