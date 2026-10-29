import { VaultItem } from '../profile';

export interface EconomyConfig {
  pity: { deathScrapPercent: number };
  currencyDrops: {
    flux: {
      extractionBonus: {
        baseAmount: number;
        perFloorMultiplier: number;
      };
    };
  };
}

export const DEFAULT_ECONOMY_CONFIG: EconomyConfig = {
  pity: { deathScrapPercent: 0.25 },
  currencyDrops: {
    flux: {
      extractionBonus: {
        baseAmount: 10,
        perFloorMultiplier: 2,
      },
    },
  },
};

/**
 * Calculates the amount of scrap to return as "pity" upon death/failure.
 */
export function calculatePityScrap(
  currentScrap: number,
  config: EconomyConfig = DEFAULT_ECONOMY_CONFIG,
): number {
  return Math.floor(currentScrap * config.pity.deathScrapPercent);
}

/**
 * Calculates the flux bonus rewarded upon successful extraction.
 */
export function calculateExtractionFluxBonus(
  floor: number,
  config: EconomyConfig = DEFAULT_ECONOMY_CONFIG,
): number {
  const { baseAmount, perFloorMultiplier } = config.currencyDrops.flux.extractionBonus;
  return baseAmount + perFloorMultiplier * floor;
}

/**
 * Maps run-scoped inventory items to permanent VaultItem format for extraction.
 */
export function mapInventoryToVaultItems(
  items: Array<{ entityId: number; templateId: string; rarityTier: string }>,
  floor: number,
  itemType: 'software' | 'equipment' | 'firmware' | 'augment' = 'software',
): VaultItem[] {
  return items.map((item) => ({
    entityId: item.entityId,
    templateId: item.templateId,
    rarityTier: item.rarityTier,
    itemType,
    extractedAtFloor: floor,
    extractedAtTimestamp: Date.now(),
  }));
}
