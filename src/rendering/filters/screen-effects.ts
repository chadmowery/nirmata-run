import { ColorMatrixFilter, Container } from 'pixi.js';

// Cache a single filter instance to avoid memory leaks (per pitfall 4)
let _grayscaleFilter: ColorMatrixFilter | null = null;
let _desatFilter: ColorMatrixFilter | null = null;

export function createDesaturationFilter(): ColorMatrixFilter {
  const filter = new ColorMatrixFilter();
  filter.desaturate();
  return filter;
}

export function applyGrayscaleToContainer(container: Container): void {
  // Reuse single instance per pitfall 4
  if (!_grayscaleFilter) {
    _grayscaleFilter = createDesaturationFilter();
  }
  container.filters = [_grayscaleFilter];
}

export function removeFiltersFromContainer(container: Container): void {
  container.filters = null;
}

export function applyStabilityDesaturation(
  container: Container,
  stabilityPercent: number,
): void {
  if (stabilityPercent > 50) {
    // No desaturation above 50%
    if (container.filters && (container.filters.includes(_desatFilter!) || container.filters.includes(_grayscaleFilter!))) {
      container.filters = null;
    }
    return;
  }
  // 50% stability = 0% desaturation, 0% stability = 100% desaturation
  if (!_desatFilter) {
    _desatFilter = new ColorMatrixFilter();
  }
  _desatFilter.reset();
  _desatFilter.desaturate();
  // Scale by how far below 50% we are
  _desatFilter.alpha = (50 - stabilityPercent) / 50;
  container.filters = [_desatFilter];
}

export function disposeScreenEffects(): void {
  if (_grayscaleFilter) {
    _grayscaleFilter.destroy();
    _grayscaleFilter = null;
  }
  if (_desatFilter) {
    _desatFilter.destroy();
    _desatFilter = null;
  }
}
