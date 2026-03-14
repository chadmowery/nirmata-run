import { z } from 'zod';
import { defineComponent } from '../../engine/ecs/types';

/**
 * Component for entities that should be rendered with a sprite.
 */
export const SpriteComponent = defineComponent('sprite', z.object({
  /** Key for the sprite texture in the assets bundle. */
  key: z.string(),
}));

/**
 * Type-safe data for the Sprite component.
 */
export type SpriteComponentData = z.infer<typeof SpriteComponent.schema>;
