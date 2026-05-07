import { describe, it, expect, vi } from 'vitest';
import { getHeatTier, HEAT_TIERS } from '../../../game/config/heat-tiers';
import { applyHeatTierFilters, clearHeatTierFilters } from '../heat-visual-effects';

// Mock PixiJS components
vi.mock('pixi.js', () => {
  class MockFilter {
    negative = vi.fn();
    desaturate = vi.fn();
    destroy = vi.fn();
  }
  class MockContainer {
    filters: any[] | null = null;
  }
  class MockSprite {
    anchor = { copyFrom: vi.fn() };
    position = { set: vi.fn() };
    visible = true;
    texture = {};
    destroy = vi.fn();
  }
  return {
    ColorMatrixFilter: MockFilter,
    Container: MockContainer,
    Sprite: MockSprite,
    Filter: MockFilter,
  };
});

vi.mock('pixi-filters', () => {
  return {
    GlitchFilter: class {},
    RGBSplitFilter: class {},
  };
});

describe('Heat Visual Effects', () => {
  describe('getHeatTier', () => {
    it('returns tier 0 for heat 0-49', () => {
      expect(getHeatTier(0).tier).toBe(0);
      expect(getHeatTier(49).tier).toBe(0);
    });

    it('returns tier 1 for heat 50-79', () => {
      expect(getHeatTier(50).tier).toBe(1);
      expect(getHeatTier(79).tier).toBe(1);
    });

    it('returns tier 2 for heat 80-99', () => {
      expect(getHeatTier(80).tier).toBe(2);
      expect(getHeatTier(99).tier).toBe(2);
    });

    it('returns tier 3 for heat 100-119', () => {
      expect(getHeatTier(100).tier).toBe(3);
      expect(getHeatTier(119).tier).toBe(3);
    });

    it('returns tier 4 for heat 120-159', () => {
      expect(getHeatTier(120).tier).toBe(4);
      expect(getHeatTier(159).tier).toBe(4);
    });

    it('returns tier 5 for heat 160+', () => {
      expect(getHeatTier(160).tier).toBe(5);
      expect(getHeatTier(999).tier).toBe(5);
    });
  });

  describe('applyHeatTierFilters', () => {
    it('applies no heat filters for tier 0-2 (world level)', () => {
      const container: any = { filters: null };
      applyHeatTierFilters(container, 0);
      expect(container.filters).toBeNull();
      
      applyHeatTierFilters(container, 1);
      expect(container.filters).toBeNull();

      applyHeatTierFilters(container, 2);
      expect(container.filters).toBeNull();
    });

    it('applies inversion filter for tier 3', () => {
      const container: any = { filters: null };
      applyHeatTierFilters(container, 3);
      expect(container.filters).toHaveLength(1);
    });

    it('applies cumulative filters for tier 5', () => {
      const container: any = { filters: null };
      applyHeatTierFilters(container, 5);
      // Cumulative tiers 3 (inversion), 4 (screen-tear), 5 (grayscale)
      expect(container.filters).toHaveLength(3);
    });

    it('clears heat filters', () => {
      const container: any = { filters: null };
      applyHeatTierFilters(container, 5);
      expect(container.filters).not.toBeNull();
      
      clearHeatTierFilters(container);
      expect(container.filters).toBeNull();
    });
  });
});
