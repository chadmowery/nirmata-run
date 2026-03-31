import { Sprite, Filter } from 'pixi.js';
import { GlitchFilter, RGBSplitFilter } from 'pixi-filters';
import { AIBehaviorType } from '@shared/components/ai-state';

/**
 * Applies a persistent glitch effect to an enemy sprite based on its behavior type.
 * Limited to max 2 filters for performance.
 */
export function applyPersistentGlitch(sprite: Sprite, behaviorType: AIBehaviorType): void {
  const filters: Filter[] = [];

  switch (behaviorType) {
    case AIBehaviorType.NULL_POINTER:
      // subtle chromatic aberration
      filters.push(new RGBSplitFilter({
        red: { x: 1, y: 0 },
        green: { x: 0, y: 1 },
        blue: { x: 0, y: 0 }
      }));
      break;

    case AIBehaviorType.BUFFER_OVERFLOW:
      // mild split
      filters.push(new RGBSplitFilter({
        red: { x: 0.5, y: 0 },
        green: { x: 0, y: 0.5 },
        blue: { x: 0, y: 0 }
      }));
      break;

    case AIBehaviorType.FRAGMENTER:
      // subtle horizontal tear
      filters.push(new GlitchFilter({
        slices: 3,
        offset: 5,
        direction: 0,
        fillMode: 0
      }));
      break;

    case AIBehaviorType.LOGIC_LEAKER:
      // more pronounced split
      filters.push(new RGBSplitFilter({
        red: { x: 1.5, y: 0 },
        green: { x: 0, y: 1.5 },
        blue: { x: 0, y: 0 }
      }));
      break;

    case AIBehaviorType.SYSTEM_ADMIN:
      // heavy static
      filters.push(new GlitchFilter({
        slices: 8,
        offset: 10,
        direction: 0,
        fillMode: 0
      }));
      break;

    case AIBehaviorType.SEED_EATER:
      // combo
      filters.push(new GlitchFilter({
        slices: 5,
        offset: 8,
        direction: 0,
        fillMode: 0
      }));
      filters.push(new RGBSplitFilter({
        red: { x: 0.8, y: 0 },
        green: { x: 0, y: 0.8 },
        blue: { x: 0, y: 0 }
      }));
      break;

    default:
      // very light split for basic enemies
      filters.push(new RGBSplitFilter({
        red: { x: 0.3, y: 0 },
        green: { x: 0, y: 0.3 },
        blue: { x: 0, y: 0 }
      }));
      break;
  }

  sprite.filters = filters;
}

/**
 * Applies a temporary heavy glitch distortion when an entity takes damage.
 */
export function applyDamageDistortion(sprite: Sprite, duration: number = 200): void {
  if (!sprite || sprite.destroyed) return;

  const originalFilters = sprite.filters || [];
  const damageGlitch = new GlitchFilter({
    slices: 10,
    offset: 30,
    direction: 0
  });

  sprite.filters = [...(Array.isArray(originalFilters) ? originalFilters : [originalFilters]), damageGlitch];

  setTimeout(() => {
    if (!sprite.destroyed) {
      sprite.filters = originalFilters as Filter | Filter[] | null;
    }
  }, duration);
}

/**
 * Cleans up filters from a sprite.
 */
export function removePersistentGlitch(sprite: Sprite): void {
  if (sprite) {
    sprite.filters = null;
  }
}
