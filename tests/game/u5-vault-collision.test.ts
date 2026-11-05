import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VaultItem, generateVaultItemId, PlayerProfileSchema } from '@shared/profile';
import { discardOverflowItem, sellOverflowItem } from '@/game/systems/vault-manager';
import { mapInventoryToVaultItems } from '@shared/utils/economy-util';

describe('U5: Vault Item Unique ID & Collision Remediation', () => {
  it('mints unique stable vaultItemId even when items share identical run-local entityIds', () => {
    const item1 = mapInventoryToVaultItems(
      [{ entityId: 10, templateId: 'rifle-v1', rarityTier: 'common' }],
      1,
      'equipment',
    )[0];

    const item2 = mapInventoryToVaultItems(
      [{ entityId: 10, templateId: 'armor-v1', rarityTier: 'rare' }],
      2,
      'equipment',
    )[0];

    expect(item1.entityId).toBe(10);
    expect(item2.entityId).toBe(10);
    expect(item1.vaultItemId).toBeDefined();
    expect(item2.vaultItemId).toBeDefined();
    expect(item1.vaultItemId).not.toBe(item2.vaultItemId);
  });

  it('populates default vaultItemId when parsing existing profiles without vaultItemId', () => {
    const legacyItem = {
      entityId: 42,
      templateId: 'vampire-v1',
      rarityTier: 'legendary',
      itemType: 'software',
      extractedAtFloor: 5,
      extractedAtTimestamp: 12345678,
    };

    const parsedProfile = PlayerProfileSchema.parse({
      sessionId: 'legacy-session',
      vault: [legacyItem],
    });

    expect(parsedProfile.vault[0].vaultItemId).toBeDefined();
    expect(typeof parsedProfile.vault[0].vaultItemId).toBe('string');
    expect(parsedProfile.vault[0].vaultItemId.length).toBeGreaterThan(0);
  });

  it('sellOverflowItem sells only the targeted item when two items share the same entityId', async () => {
    const idA = generateVaultItemId();
    const idB = generateVaultItemId();

    const mockProfile = {
      sessionId: 'test-session',
      wallet: { scrap: 0, flux: 0 },
      vault: [
        {
          vaultItemId: idA,
          entityId: 99,
          templateId: 'rifle-v1',
          rarityTier: 'common',
          itemType: 'weapon' as const,
          extractedAtFloor: 1,
          extractedAtTimestamp: 100,
        },
        {
          vaultItemId: idB,
          entityId: 99,
          templateId: 'armor-v1',
          rarityTier: 'common',
          itemType: 'armor' as const,
          extractedAtFloor: 2,
          extractedAtTimestamp: 200,
        },
      ],
      overflow: [],
    };

    const repo = {
      load: vi.fn().mockResolvedValue(mockProfile),
      save: vi.fn().mockImplementation(async (p) => {
        Object.assign(mockProfile, p);
      }),
    };

    // Sell only item B by its unique vaultItemId
    const result = await sellOverflowItem(repo as any, 'test-session', idB);
    expect(result.success).toBe(true);
    expect(mockProfile.vault).toHaveLength(1);
    expect(mockProfile.vault[0].vaultItemId).toBe(idA);
    expect(mockProfile.vault[0].templateId).toBe('rifle-v1');
  });

  it('discardOverflowItem removes only the targeted item when two items share the same entityId', async () => {
    const idA = generateVaultItemId();
    const idB = generateVaultItemId();

    const mockProfile = {
      sessionId: 'test-session',
      wallet: { scrap: 0, flux: 0 },
      vault: [
        {
          vaultItemId: idA,
          entityId: 55,
          templateId: 'subroutine-a',
          rarityTier: 'common',
          itemType: 'software' as const,
          extractedAtFloor: 1,
          extractedAtTimestamp: 100,
        },
        {
          vaultItemId: idB,
          entityId: 55,
          templateId: 'subroutine-b',
          rarityTier: 'common',
          itemType: 'software' as const,
          extractedAtFloor: 2,
          extractedAtTimestamp: 200,
        },
      ],
      overflow: [],
    };

    const repo = {
      load: vi.fn().mockResolvedValue(mockProfile),
      save: vi.fn().mockImplementation(async (p) => {
        Object.assign(mockProfile, p);
      }),
    };

    // Discard only item A by its unique vaultItemId
    const success = await discardOverflowItem(repo as any, 'test-session', idA);
    expect(success).toBe(true);
    expect(mockProfile.vault).toHaveLength(1);
    expect(mockProfile.vault[0].vaultItemId).toBe(idB);
    expect(mockProfile.vault[0].templateId).toBe('subroutine-b');
  });
});
