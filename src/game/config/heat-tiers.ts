/**
 * Heat tier threshold definitions and CSS class names.
 * Defines 6 discrete tiers at thresholds 0/50/80/100/120/160.
 */

export interface HeatTier {
  tier: number;       // 0-5
  name: string;       // 'clean' | 'jitter' | 'ghosting' | 'inversion' | 'screen-tear' | 'grayscale'
  threshold: number;  // minimum Heat value for this tier
  cssClass: string;   // CSS class name for HUD effects
  hasPixiFilters: boolean; // whether this tier has PixiJS world filters
}

export const HEAT_TIERS: HeatTier[] = [
  { tier: 0, name: 'clean',       threshold: 0,   cssClass: 'heatTierClean',      hasPixiFilters: false },
  { tier: 1, name: 'jitter',      threshold: 50,  cssClass: 'heatTierJitter',     hasPixiFilters: false },
  { tier: 2, name: 'ghosting',    threshold: 80,  cssClass: 'heatTierGhosting',   hasPixiFilters: true },
  { tier: 3, name: 'inversion',   threshold: 100, cssClass: 'heatTierInversion',  hasPixiFilters: true },
  { tier: 4, name: 'screen-tear', threshold: 120, cssClass: 'heatTierScreenTear', hasPixiFilters: true },
  { tier: 5, name: 'grayscale',   threshold: 160, cssClass: 'heatTierGrayscale',  hasPixiFilters: true },
];

/**
 * Get the current Heat tier based on heat value.
 * Walk backwards through tiers to find highest matching threshold.
 */
export function getHeatTier(heatValue: number): HeatTier {
  for (let i = HEAT_TIERS.length - 1; i >= 0; i--) {
    if (heatValue >= HEAT_TIERS[i].threshold) return HEAT_TIERS[i];
  }
  return HEAT_TIERS[0];
}
