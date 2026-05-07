import { ColorMatrixFilter, Container, Sprite, Filter } from 'pixi.js';
import { GlitchFilter, RGBSplitFilter } from 'pixi-filters';

// Cache filter instances to avoid memory leaks
let _inversionFilter: ColorMatrixFilter | null = null;
let _screenTearFilter: GlitchFilter | null = null;
let _grayscaleFilter: ColorMatrixFilter | null = null;

// WeakMap to track ghost sprites per player sprite
const ghostSprites = new WeakMap<Sprite, { ghost: Sprite; lastTier: number }>();

/**
 * Applies cumulative PixiJS world filters based on the current Heat tier.
 * Filters are applied in order: [inversion, screen-tear, grayscale] on the worldContainer.
 */
export function applyHeatTierFilters(container: Container, tier: number): void {
  const filters: Filter[] = [];

  // Tier 3: Inversion
  if (tier >= 3) {
    if (!_inversionFilter) {
      _inversionFilter = new ColorMatrixFilter();
      _inversionFilter.negative(true);
    }
    filters.push(_inversionFilter as unknown as Filter);
  }

  // Tier 4: Screen-tear
  if (tier >= 4) {
    if (!_screenTearFilter) {
      _screenTearFilter = new GlitchFilter({
        slices: 8,
        offset: 15,
        direction: 0,
      });
    }
    filters.push(_screenTearFilter as unknown as Filter);
  }

  // Tier 5: Grayscale
  if (tier >= 5) {
    if (!_grayscaleFilter) {
      _grayscaleFilter = new ColorMatrixFilter();
      _grayscaleFilter.desaturate();
    }
    filters.push(_grayscaleFilter as unknown as Filter);
  }

  // Maintain stability filters if present (external management assumed, but we avoid overwriting)
  // NOTE: Per plan, we track Heat filters separately. In this simple implementation,
  // we set container.filters. If other systems use filters, they must be merged.
  // For now, we follow the pattern of setting them directly or merging if possible.
  
  const existingFilters = container.filters ? (Array.isArray(container.filters) ? container.filters : [container.filters]) : [];
  
  // Remove existing heat filters before adding new ones
  const heatFilterInstances = [_inversionFilter, _screenTearFilter, _grayscaleFilter] as unknown as Filter[];
  const nonHeatFilters = existingFilters.filter(f => !heatFilterInstances.includes(f));
  
  container.filters = [...nonHeatFilters, ...filters];
  if (container.filters.length === 0) container.filters = null;
}

/**
 * Removes all Heat-related filters from the container.
 */
export function clearHeatTierFilters(container: Container): void {
  if (!container.filters) return;
  
  const existingFilters = Array.isArray(container.filters) ? container.filters : [container.filters];
  const heatFilterInstances = [_inversionFilter, _screenTearFilter, _grayscaleFilter] as unknown as Filter[];
  
  const filtered = existingFilters.filter(f => !heatFilterInstances.includes(f));
  container.filters = filtered.length > 0 ? filtered : null;
}

/**
 * Manages the pink sprite ghosting effect for the player sprite (Tier 2).
 * Creates a secondary sprite with an offset and pink tint.
 */
export function updateSpriteGhosting(playerSprite: Sprite, tier: number, entityLayer: Container): void {
  const state = ghostSprites.get(playerSprite);

  if (tier < 2) {
    if (state) {
      state.ghost.destroy();
      ghostSprites.delete(playerSprite);
    }
    return;
  }

  if (!state) {
    // Create new ghost sprite
    const ghost = new Sprite(playerSprite.texture);
    ghost.anchor.copyFrom(playerSprite.anchor);
    ghost.alpha = 0.4;
    
    const pinkSplit = new RGBSplitFilter({
      red: { x: 2, y: 0 },
      green: { x: -2, y: 0 },
      blue: { x: 2, y: 0 }
    });
    ghost.filters = [pinkSplit as unknown as Filter];
    
    entityLayer.addChild(ghost);
    ghostSprites.set(playerSprite, { ghost, lastTier: tier });
  }

  // Update ghost position with offset
  const currentState = ghostSprites.get(playerSprite)!;
  currentState.ghost.position.set(playerSprite.x + 3, playerSprite.y + 2);
  currentState.ghost.visible = playerSprite.visible;
  currentState.lastTier = tier;
}

/**
 * Disposes all cached filter instances and cleans up ghost sprites.
 */
export function disposeHeatEffects(): void {
  if (_inversionFilter) {
    _inversionFilter.destroy();
    _inversionFilter = null;
  }
  if (_screenTearFilter) {
    _screenTearFilter.destroy();
    _screenTearFilter = null;
  }
  if (_grayscaleFilter) {
    _grayscaleFilter.destroy();
    _grayscaleFilter = null;
  }
}
