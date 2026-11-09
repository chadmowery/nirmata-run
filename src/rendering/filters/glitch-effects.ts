import { Sprite, Filter } from 'pixi.js';
import { GlitchFilter, RGBSplitFilter, OutlineFilter } from 'pixi-filters';
import { AIBehaviorType } from '@shared/components/ai-state';

export type PropVisualState = 'safe' | 'locked' | 'corrupted' | 'searched';

const activePropFilters = new Map<Sprite, Filter[]>();
const activeEnemyFilters = new Map<Sprite, Filter[]>();
let activeDamageFilterCount = 0;

export interface FilterTelemetry {
  activePropFilterSprites: number;
  totalPropFilters: number;
  activeEnemyFilterSprites: number;
  totalEnemyFilters: number;
  activeDamageFilters: number;
}

/**
 * Returns read-only active filter telemetry.
 */
export function getFilterTelemetry(): FilterTelemetry {
  let totalPropFilters = 0;
  for (const filters of activePropFilters.values()) {
    totalPropFilters += filters.length;
  }
  let totalEnemyFilters = 0;
  for (const filters of activeEnemyFilters.values()) {
    totalEnemyFilters += filters.length;
  }
  return {
    activePropFilterSprites: activePropFilters.size,
    totalPropFilters,
    activeEnemyFilterSprites: activeEnemyFilters.size,
    totalEnemyFilters,
    activeDamageFilters: activeDamageFilterCount,
  };
}

/**
 * Applies a visual outline/glitch effect to an interactive prop sprite based on its state:
 * - 'safe': #00F0FF (Cyan) clean outline
 * - 'locked': #FF9500 (Orange) security barrier outline
 * - 'corrupted': #FF0055 (Pink) outline with subtle glitch jitter
 * - 'searched': Dimmed alpha (0.6) with no outline
 *
 * Composes safely with existing filters (e.g. damage glitch) and destroys replaced filters.
 */
export function applyPropOutline(sprite: Sprite, state: PropVisualState): void {
  if (!sprite || sprite.destroyed) return;

  // Retrieve and clean up existing prop outline filters
  const existingPropFilters = activePropFilters.get(sprite) || [];
  for (const f of existingPropFilters) {
    if (typeof f.destroy === 'function') {
      f.destroy();
    }
  }
  activePropFilters.delete(sprite);

  // Preserve other filters on the sprite (such as temporary damage filters)
  const currentFilters = Array.isArray(sprite.filters)
    ? sprite.filters
    : sprite.filters
      ? [sprite.filters]
      : [];
  const nonPropFilters = currentFilters.filter((f) => !existingPropFilters.includes(f));

  if (state === 'searched') {
    sprite.filters = nonPropFilters.length > 0 ? nonPropFilters : null;
    sprite.alpha = 0.6;
    return;
  }

  const newFilters: Filter[] = [];

  switch (state) {
    case 'safe':
      newFilters.push(
        new OutlineFilter({
          thickness: 1,
          color: 0x00f0ff,
        }) as Filter,
      );
      break;

    case 'locked':
      newFilters.push(
        new OutlineFilter({
          thickness: 1,
          color: 0xff9500,
        }) as Filter,
      );
      break;

    case 'corrupted':
      newFilters.push(
        new OutlineFilter({
          thickness: 1,
          color: 0xff0055,
        }) as Filter,
      );
      newFilters.push(
        new GlitchFilter({
          slices: 2,
          offset: 3,
          direction: 0,
        }) as Filter,
      );
      break;
  }

  activePropFilters.set(sprite, newFilters);
  const combined = [...nonPropFilters, ...newFilters];
  sprite.filters = combined.length > 0 ? combined : null;
}

/**
 * Applies a persistent glitch effect to an enemy sprite based on its behavior type.
 * Limited to max 2 filters for performance.
 */
export function applyPersistentGlitch(sprite: Sprite, behaviorType: AIBehaviorType): void {
  const filters: Filter[] = [];

  switch (behaviorType) {
    case AIBehaviorType.NULL_POINTER:
      // subtle chromatic aberration
      filters.push(
        new RGBSplitFilter({
          red: { x: 1, y: 0 },
          green: { x: 0, y: 1 },
          blue: { x: 0, y: 0 },
        }),
      );
      break;

    case AIBehaviorType.BUFFER_OVERFLOW:
      // mild split
      filters.push(
        new RGBSplitFilter({
          red: { x: 0.5, y: 0 },
          green: { x: 0, y: 0.5 },
          blue: { x: 0, y: 0 },
        }),
      );
      break;

    case AIBehaviorType.FRAGMENTER:
      // subtle horizontal tear
      filters.push(
        new GlitchFilter({
          slices: 3,
          offset: 5,
          direction: 0,
          fillMode: 0,
        }),
      );
      break;

    case AIBehaviorType.LOGIC_LEAKER:
      // more pronounced split
      filters.push(
        new RGBSplitFilter({
          red: { x: 1.5, y: 0 },
          green: { x: 0, y: 1.5 },
          blue: { x: 0, y: 0 },
        }),
      );
      break;

    case AIBehaviorType.SYSTEM_ADMIN:
      // heavy static
      filters.push(
        new GlitchFilter({
          slices: 8,
          offset: 10,
          direction: 0,
          fillMode: 0,
        }),
      );
      break;

    case AIBehaviorType.SEED_EATER:
      // combo
      filters.push(
        new GlitchFilter({
          slices: 5,
          offset: 8,
          direction: 0,
          fillMode: 0,
        }),
      );
      filters.push(
        new RGBSplitFilter({
          red: { x: 0.8, y: 0 },
          green: { x: 0, y: 0.8 },
          blue: { x: 0, y: 0 },
        }),
      );
      break;

    default:
      // very light split for basic enemies
      filters.push(
        new RGBSplitFilter({
          red: { x: 0.3, y: 0 },
          green: { x: 0, y: 0.3 },
          blue: { x: 0, y: 0 },
        }),
      );
      break;
  }

  // Clean up any existing persistent glitch filters
  const existing = activeEnemyFilters.get(sprite);
  if (existing) {
    for (const f of existing) {
      if (typeof f.destroy === 'function') f.destroy();
    }
  }
  activeEnemyFilters.set(sprite, filters);
  sprite.filters = filters;
}

/**
 * Tracking for active damage filters to avoid race conditions and leaks.
 */
const activeDamageFilters = new WeakMap<
  Sprite,
  { filter: GlitchFilter; timeoutId: ReturnType<typeof setTimeout> }
>();

/**
 * Applies a temporary heavy glitch distortion when an entity takes damage.
 * Now safe from overlapping damage events.
 */
export function applyDamageDistortion(sprite: Sprite, duration: number = 200): void {
  if (!sprite || sprite.destroyed) return;

  const existing = activeDamageFilters.get(sprite);
  if (existing) {
    // If a damage glitch is already active, just reset its timer
    clearTimeout(existing.timeoutId);
    existing.timeoutId = setTimeout(() => {
      cleanupDamageFilter(sprite);
    }, duration);
    return;
  }

  const damageGlitch = new GlitchFilter({
    slices: 10,
    offset: 30,
    direction: 0,
  });

  // Specifically add our new filter to the existing set
  const currentFilters = Array.isArray(sprite.filters)
    ? [...sprite.filters]
    : sprite.filters
      ? [sprite.filters]
      : [];

  sprite.filters = [...currentFilters, damageGlitch];

  const timeoutId = setTimeout(() => {
    cleanupDamageFilter(sprite);
  }, duration);

  activeDamageFilterCount++;
  activeDamageFilters.set(sprite, { filter: damageGlitch, timeoutId });
}

/**
 * Specifically removes the damage glitch instance from the sprite's filter list.
 */
function cleanupDamageFilter(sprite: Sprite): void {
  const state = activeDamageFilters.get(sprite);
  if (!state || sprite.destroyed) {
    if (state) {
      activeDamageFilterCount = Math.max(0, activeDamageFilterCount - 1);
    }
    activeDamageFilters.delete(sprite);
    return;
  }

  activeDamageFilterCount = Math.max(0, activeDamageFilterCount - 1);

  const filters = sprite.filters;
  if (!filters) {
    activeDamageFilters.delete(sprite);
    return;
  }

  // Treat as array for PixiJS 8 compatibility
  const filtersArray = Array.isArray(filters) ? filters : [filters];

  // Use unknown cast to bypass the "no overlap" error between different Filter versions/types
  const targetFilter = state.filter as unknown as Filter;
  const newFilters = (filtersArray as Filter[]).filter((f) => f !== targetFilter);

  sprite.filters = newFilters.length > 0 ? newFilters : null;

  activeDamageFilters.delete(sprite);
}

/**
 * Cleans up all filters from a sprite and clears any active damage tracking.
 */
export function removePersistentGlitch(sprite: Sprite): void {
  if (!sprite) return;

  // Clear any pending damage cleanup timeouts
  const state = activeDamageFilters.get(sprite);
  if (state) {
    clearTimeout(state.timeoutId);
    activeDamageFilterCount = Math.max(0, activeDamageFilterCount - 1);
    activeDamageFilters.delete(sprite);
  }

  // Clear any active prop outline filters and destroy them
  const propFilters = activePropFilters.get(sprite);
  if (propFilters) {
    for (const f of propFilters) {
      if (typeof f.destroy === 'function') f.destroy();
    }
    activePropFilters.delete(sprite);
  }

  // Clear any active enemy glitch filters and destroy them
  const enemyFilters = activeEnemyFilters.get(sprite);
  if (enemyFilters) {
    for (const f of enemyFilters) {
      if (typeof f.destroy === 'function') f.destroy();
    }
    activeEnemyFilters.delete(sprite);
  }

  sprite.filters = null;
}
