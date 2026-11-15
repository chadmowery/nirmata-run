import { ColorMatrixFilter, Container, Filter } from 'pixi.js';

// Cache a single filter instance to avoid memory leaks (per pitfall 4)
let _grayscaleFilter: ColorMatrixFilter | null = null;
let _desatFilter: ColorMatrixFilter | null = null;

function getScreenEffectFilterSet(): Set<Filter> {
  const set = new Set<Filter>();
  if (_grayscaleFilter) set.add(_grayscaleFilter);
  if (_desatFilter) set.add(_desatFilter);
  return set;
}

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
  const existing = container.filters
    ? Array.isArray(container.filters)
      ? [...container.filters]
      : [container.filters]
    : [];
  const effectSet = getScreenEffectFilterSet();
  const preserved = existing.filter((f) => !effectSet.has(f));
  container.filters = [...preserved, _grayscaleFilter];
}

export function removeFiltersFromContainer(container: Container): void {
  container.filters = null;
}

export function getActiveScreenEffectFilters(): Filter[] {
  const out: Filter[] = [];
  if (_desatFilter) out.push(_desatFilter);
  if (_grayscaleFilter) out.push(_grayscaleFilter);
  return out;
}

export function applyStabilityDesaturation(container: Container, stabilityPercent: number): void {
  const existing = container.filters
    ? Array.isArray(container.filters)
      ? [...container.filters]
      : [container.filters]
    : [];
  const effectSet = getScreenEffectFilterSet();
  const preserved = existing.filter((f) => !effectSet.has(f));

  if (stabilityPercent > 50) {
    container.filters = preserved.length > 0 ? preserved : null;
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
  container.filters = [...preserved, _desatFilter];
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
