import { describe, it, expect } from 'vitest';
import { grantDebugVaultAndCurrencies, VAULT_MAX_SLOTS } from '../vault';
import { createDefaultProfile } from '../profile';

describe('grantDebugVaultAndCurrencies', () => {
  it('grants items across all types up to max vault capacity and gives 1000 of every currency', () => {
    const profile = createDefaultProfile('test-debug-vault');
    expect(profile.vault).toHaveLength(0);
    const initialScrap = profile.wallet.scrap;
    const initialFlux = profile.wallet.flux;

    const result = grantDebugVaultAndCurrencies(profile);

    expect(result.itemsGranted).toBe(VAULT_MAX_SLOTS);
    expect(result.vaultFull).toBe(true);
    expect(profile.vault).toHaveLength(VAULT_MAX_SLOTS);

    // Verify all 5 distinct item types are represented in the vault
    const typesPresent = new Set(profile.vault.map((item) => item.itemType));
    expect(typesPresent.has('firmware')).toBe(true);
    expect(typesPresent.has('augment')).toBe(true);
    expect(typesPresent.has('software')).toBe(true);
    expect(typesPresent.has('weapon')).toBe(true);
    expect(typesPresent.has('armor')).toBe(true);

    // Verify 1000 of every currency was added
    expect(result.scrapAdded).toBe(1000);
    expect(result.fluxAdded).toBe(1000);
    expect(profile.wallet.scrap).toBe(initialScrap + 1000);
    expect(profile.wallet.flux).toBe(initialFlux + 1000);
  });

  it('stops granting items when vault does not have enough space, and proceeds to currencies', () => {
    const profile = createDefaultProfile('test-partial-vault');

    // Pre-populate with 27 dummy items (only 3 slots remaining)
    for (let i = 0; i < 27; i++) {
      profile.vault.push({
        entityId: 1000 + i,
        templateId: 'dummy-item',
        rarityTier: 'common',
        itemType: 'software',
        extractedAtFloor: 1,
        extractedAtTimestamp: Date.now(),
      });
    }
    expect(profile.vault).toHaveLength(27);

    const result = grantDebugVaultAndCurrencies(profile);

    // Should grant only 3 items to reach 30, then stop
    expect(result.itemsGranted).toBe(3);
    expect(result.vaultFull).toBe(true);
    expect(profile.vault).toHaveLength(30);

    // Round 1 items (first 3 types: firmware, augment, software) should be granted
    expect(profile.vault[27].itemType).toBe('firmware');
    expect(profile.vault[28].itemType).toBe('augment');
    expect(profile.vault[29].itemType).toBe('software');

    // Currencies are still granted
    expect(profile.wallet.scrap).toBe(1000);
    expect(profile.wallet.flux).toBe(1000);
  });

  it('grants 0 items if vault is already full, but still grants 1000 of every currency', () => {
    const profile = createDefaultProfile('test-full-vault');

    // Fill vault to max
    for (let i = 0; i < VAULT_MAX_SLOTS; i++) {
      profile.vault.push({
        entityId: 2000 + i,
        templateId: 'existing-item',
        rarityTier: 'rare',
        itemType: 'augment',
        extractedAtFloor: 1,
        extractedAtTimestamp: Date.now(),
      });
    }
    profile.wallet.scrap = 500;
    profile.wallet.flux = 50;

    const result = grantDebugVaultAndCurrencies(profile);

    expect(result.itemsGranted).toBe(0);
    expect(result.vaultFull).toBe(true);
    expect(profile.vault).toHaveLength(VAULT_MAX_SLOTS);

    // Currencies are still granted
    expect(profile.wallet.scrap).toBe(1500);
    expect(profile.wallet.flux).toBe(1050);
  });
});
