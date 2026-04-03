import economy from '../../game/entities/templates/economy.json';
import { VaultItem } from '../profile';

/**
 * Calculates the amount of scrap to return as "pity" upon death/failure.
 */
export function calculatePityScrap(currentScrap: number): number {
  return Math.floor(currentScrap * economy.pity.deathScrapPercent);
}

/**
 * Calculates the flux bonus rewarded upon successful extraction.
 */
export function calculateExtractionFluxBonus(floor: number): number {
  const { baseAmount, perFloorMultiplier } = economy.currencyDrops.flux.extractionBonus;
  return baseAmount + (perFloorMultiplier * floor);
}

/**
 * Maps run-scoped software inventory to permanent VaultItem format for extraction.
 */
export function mapInventoryToVaultItems(
  softwareItems: Array<{ entityId: number; templateId: string; rarityTier: string }>,
  floor: number
): VaultItem[] {
  return softwareItems.map(item => ({
    entityId: item.entityId,
    templateId: item.templateId,
    rarityTier: item.rarityTier,
    itemType: 'software', // Per D-06: Software is the primary extracted item type
    extractedAtFloor: floor,
    extractedAtTimestamp: Date.now(),
  }));
}
