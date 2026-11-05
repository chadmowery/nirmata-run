import { generateVaultItemId, type PlayerProfile, type VaultItem } from './profile';

export const VAULT_MAX_SLOTS = 30;

export const SELL_VALUES: Record<string, number> = {
  common: 15,
  uncommon: 30,
  rare: 60,
  legendary: 150,
};

/**
 * Calculates the scrap salvage value of a vault or overflow item.
 * Includes base value from rarity tier plus bonus value from any socketed software.
 */
export function getVaultItemValue(
  item: Pick<VaultItem, 'rarityTier'> & { socketedSoftware?: string[] },
): number {
  const baseValue = SELL_VALUES[item.rarityTier?.toLowerCase()] ?? 15;
  let softwareBonus = 0;
  if (item.socketedSoftware && item.socketedSoftware.length > 0) {
    for (const sw of item.socketedSoftware) {
      if (sw.includes('v3')) softwareBonus += 60;
      else if (sw.includes('v2')) softwareBonus += 40;
      else if (sw.includes('v1')) softwareBonus += 25;
      else softwareBonus += 15;
    }
  }
  return baseValue + softwareBonus;
}

/**
 * Infers item type from templateId.
 * Firmware: ends with .sh, .exe, .sys
 * Augment: ends with .arc
 * Software: anything else
 */
export function inferItemType(templateId: string): 'firmware' | 'augment' | 'software' {
  const lower = templateId.toLowerCase();
  if (lower.endsWith('.sh') || lower.endsWith('.exe') || lower.endsWith('.sys')) {
    return 'firmware';
  }
  if (lower.endsWith('.arc')) {
    return 'augment';
  }
  return 'software';
}

export interface DebugGrantResult {
  itemsGranted: number;
  vaultFull: boolean;
  scrapAdded: number;
  fluxAdded: number;
}

export const DEBUG_VAULT_CATALOG: Array<{
  templateId: string;
  rarityTier: string;
  itemType: 'firmware' | 'augment' | 'software' | 'equipment' | 'weapon' | 'armor' | 'consumable';
}> = [
  // Round 1: 1 of each of all 5 distinct item types (guarantees diverse representation)
  { templateId: 'phase-shift', rarityTier: 'common', itemType: 'firmware' },
  { templateId: 'displacement-venting', rarityTier: 'uncommon', itemType: 'augment' },
  { templateId: 'bleed-v1', rarityTier: 'uncommon', itemType: 'software' },
  { templateId: 'rifle-v1', rarityTier: 'common', itemType: 'weapon' },
  { templateId: 'armor-v1', rarityTier: 'common', itemType: 'armor' },

  // Round 2: 2nd item of each type with varied rarities
  { templateId: 'neural-spike', rarityTier: 'common', itemType: 'firmware' },
  { templateId: 'static-siphon', rarityTier: 'rare', itemType: 'augment' },
  { templateId: 'auto-loader-v1', rarityTier: 'uncommon', itemType: 'software' },
  { templateId: 'rifle-v2', rarityTier: 'uncommon', itemType: 'weapon' },
  { templateId: 'armor-v2', rarityTier: 'uncommon', itemType: 'armor' },

  // Round 3: 3rd item of each type with legendary/rare tiers
  { templateId: 'ghost-pulse', rarityTier: 'common', itemType: 'firmware' },
  { templateId: 'phased-overdrive', rarityTier: 'legendary', itemType: 'augment' },
  { templateId: 'vampire-v1', rarityTier: 'uncommon', itemType: 'software' },
  { templateId: 'rifle-v3', rarityTier: 'rare', itemType: 'weapon' },
  { templateId: 'armor-v3', rarityTier: 'rare', itemType: 'armor' },

  // Round 4: 4th item of types
  { templateId: 'logic-jam', rarityTier: 'common', itemType: 'firmware' },
  { templateId: 'neural-recursion', rarityTier: 'legendary', itemType: 'augment' },
  { templateId: 'health-potion', rarityTier: 'common', itemType: 'consumable' },
  { templateId: 'extended-sight', rarityTier: 'uncommon', itemType: 'firmware' },
  { templateId: 'static-collapse', rarityTier: 'legendary', itemType: 'augment' },

  // Round 5: 5th item of types
  { templateId: 'basic-strike', rarityTier: 'common', itemType: 'firmware' },
  { templateId: 'neural-feedback', rarityTier: 'rare', itemType: 'augment' },
  { templateId: 'bleed-v2', rarityTier: 'rare', itemType: 'software' },
  { templateId: 'auto-loader-v2', rarityTier: 'rare', itemType: 'software' },
  { templateId: 'void-echo', rarityTier: 'legendary', itemType: 'software' },

  // Round 6: Remaining items up to 30
  { templateId: 'kinetic-link', rarityTier: 'common', itemType: 'firmware' },
  { templateId: 'vampire-v2', rarityTier: 'rare', itemType: 'software' },
  { templateId: 'bleed-v3', rarityTier: 'legendary', itemType: 'software' },
  { templateId: 'auto-loader-v3', rarityTier: 'legendary', itemType: 'software' },
  { templateId: 'vampire-v3', rarityTier: 'legendary', itemType: 'software' },
];

/**
 * Debug helper: Grants 1 of every item type to the player's vault.
 * If granted items do not fit, stops granting items once capacity is reached
 * and moves on to granting 1000 of every currency (scrap & flux).
 */
export function grantDebugVaultAndCurrencies(profile: PlayerProfile): DebugGrantResult {
  let itemsGranted = 0;
  let vaultFull = profile.vault.length >= VAULT_MAX_SLOTS;

  // 1. Grant items to vault until capacity is reached
  if (!vaultFull) {
    const existingIds = new Set(profile.vault.map((i) => i.entityId));
    let nextEntityId = Date.now();

    for (const itemDef of DEBUG_VAULT_CATALOG) {
      if (profile.vault.length >= VAULT_MAX_SLOTS) {
        vaultFull = true;
        break;
      }
      while (existingIds.has(nextEntityId)) {
        nextEntityId++;
      }
      existingIds.add(nextEntityId);

      const vaultItem: VaultItem = {
        vaultItemId: generateVaultItemId(),
        entityId: nextEntityId,
        templateId: itemDef.templateId,
        rarityTier: itemDef.rarityTier,
        itemType: itemDef.itemType,
        extractedAtFloor: 0,
        extractedAtTimestamp: Date.now(),
      };
      profile.vault.push(vaultItem);
      itemsGranted++;
    }
  }

  // 2. Grant 1000 of every currency (scrap & flux)
  const scrapAdded = 1000;
  const fluxAdded = 1000;
  profile.wallet.scrap = (profile.wallet.scrap || 0) + scrapAdded;
  profile.wallet.flux = (profile.wallet.flux || 0) + fluxAdded;

  return {
    itemsGranted,
    vaultFull: profile.vault.length >= VAULT_MAX_SLOTS,
    scrapAdded,
    fluxAdded,
  };
}
