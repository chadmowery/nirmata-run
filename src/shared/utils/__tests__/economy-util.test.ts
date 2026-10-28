import { describe, it, expect } from 'vitest';
import {
  calculatePityScrap,
  calculateExtractionFluxBonus,
  mapInventoryToVaultItems,
  DEFAULT_ECONOMY_CONFIG,
} from '../economy-util';

describe('Economy Utilities Unit Tests', () => {
  describe('calculatePityScrap', () => {
    it('calculates 25% pity scrap based on default config', () => {
      expect(calculatePityScrap(100)).toBe(25);
      expect(calculatePityScrap(55)).toBe(13); // Math.floor
      expect(calculatePityScrap(0)).toBe(0);
    });

    it('respects custom economy config', () => {
      const customConfig = {
        ...DEFAULT_ECONOMY_CONFIG,
        pity: { deathScrapPercent: 0.5 },
      };
      expect(calculatePityScrap(100, customConfig)).toBe(50);
    });
  });

  describe('calculateExtractionFluxBonus', () => {
    it('calculates base flux plus per-floor multiplier', () => {
      // default: base 10, multiplier 2
      // Floor 1: 10 + 2 * 1 = 12
      expect(calculateExtractionFluxBonus(1)).toBe(12);
      // Floor 5: 10 + 2 * 5 = 20
      expect(calculateExtractionFluxBonus(5)).toBe(20);
      // Floor 10: 10 + 2 * 10 = 30
      expect(calculateExtractionFluxBonus(10)).toBe(30);
    });
  });

  describe('mapInventoryToVaultItems', () => {
    it('maps software inventory items to permanent VaultItem shape', () => {
      const items = [
        { entityId: 101, templateId: 'vampire-v1', rarityTier: 'rare' },
        { entityId: 102, templateId: 'firewall-v1', rarityTier: 'common' },
      ];

      const vaultItems = mapInventoryToVaultItems(items, 5);

      expect(vaultItems).toHaveLength(2);
      expect(vaultItems[0]).toEqual({
        entityId: 101,
        templateId: 'vampire-v1',
        rarityTier: 'rare',
        itemType: 'software',
        extractedAtFloor: 5,
        extractedAtTimestamp: expect.any(Number),
      });
      expect(vaultItems[1]).toEqual({
        entityId: 102,
        templateId: 'firewall-v1',
        rarityTier: 'common',
        itemType: 'software',
        extractedAtFloor: 5,
        extractedAtTimestamp: expect.any(Number),
      });
    });
  });
});
