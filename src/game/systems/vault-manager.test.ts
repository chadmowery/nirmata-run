import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  depositToOverflow, 
  discardOverflowItem, 
  sellOverflowItem, 
  moveOverflowToVault, 
  hasOverflow,
} from './vault-manager';
import { VAULT_MAX_SLOTS, SELL_VALUES } from '@shared/vault';
import { ProfileRepository } from '@shared/profile';

describe('VaultManager', () => {
  const sessionId = 'test-session';
  let mockRepo: ProfileRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRepo = {
      load: vi.fn(),
      save: vi.fn(),
    };
  });

  describe('depositToOverflow', () => {
    it('appends items to overflow array', async () => {
      const mockProfile = { sessionId, overflow: [] } as any;
      (mockRepo.load as any).mockResolvedValue(mockProfile);

      const items = [
        { entityId: 1, templateId: 'test.sh', rarityTier: 'common', itemType: 'firmware', extractedAtFloor: 1, extractedAtTimestamp: Date.now() }
      ] as any;

      await depositToOverflow(mockRepo, sessionId, items);

      expect(mockProfile.overflow).toHaveLength(1);
      expect(mockProfile.overflow[0].entityId).toBe(1);
      expect(mockRepo.save).toHaveBeenCalledWith(mockProfile);
    });
  });

  describe('discardOverflowItem', () => {
    it('removes item from overflow and returns true', async () => {
      const mockProfile = { 
        sessionId, 
        overflow: [{ entityId: 1 }, { entityId: 2 }] 
      } as any;
      (mockRepo.load as any).mockResolvedValue(mockProfile);

      const result = await discardOverflowItem(mockRepo, sessionId, 1);

      expect(result).toBe(true);
      expect(mockProfile.overflow).toHaveLength(1);
      expect(mockProfile.overflow[0].entityId).toBe(2);
      expect(mockRepo.save).toHaveBeenCalledWith(mockProfile);
    });

    it('returns false if item not found', async () => {
      const mockProfile = { sessionId, overflow: [{ entityId: 2 }] } as any;
      (mockRepo.load as any).mockResolvedValue(mockProfile);

      const result = await discardOverflowItem(mockRepo, sessionId, 1);

      expect(result).toBe(false);
      expect(mockProfile.overflow).toHaveLength(1);
      expect(mockRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('sellOverflowItem', () => {
    it('removes item and adds scrap based on rarity', async () => {
      const mockProfile = { 
        sessionId, 
        wallet: { scrap: 100 },
        overflow: [{ entityId: 1, rarityTier: 'uncommon' }] 
      } as any;
      (mockRepo.load as any).mockResolvedValue(mockProfile);

      const result = await sellOverflowItem(mockRepo, sessionId, 1);

      expect(result.success).toBe(true);
      expect(result.scrapGained).toBe(SELL_VALUES.uncommon);
      expect(mockProfile.wallet.scrap).toBe(100 + SELL_VALUES.uncommon);
      expect(mockProfile.overflow).toHaveLength(0);
      expect(mockRepo.save).toHaveBeenCalled();
    });

    it('respects scrap cap', async () => {
      const mockProfile = { 
        sessionId, 
        wallet: { scrap: 9990 },
        overflow: [{ entityId: 1, rarityTier: 'legendary' }] 
      } as any;
      (mockRepo.load as any).mockResolvedValue(mockProfile);

      const result = await sellOverflowItem(mockRepo, sessionId, 1);

      expect(result.success).toBe(true);
      expect(mockProfile.wallet.scrap).toBe(10000); // economy.caps.scrap is 10000
      expect(mockRepo.save).toHaveBeenCalled();
    });
  });

  describe('moveOverflowToVault', () => {
    it('moves all items if vault has room', async () => {
      const mockProfile = { 
        sessionId, 
        vault: [], 
        overflow: [{ entityId: 1 }, { entityId: 2 }] 
      } as any;
      (mockRepo.load as any).mockResolvedValue(mockProfile);

      const result = await moveOverflowToVault(mockRepo, sessionId);

      expect(result.moved).toBe(2);
      expect(result.remaining).toBe(0);
      expect(mockProfile.vault).toHaveLength(2);
      expect(mockProfile.overflow).toHaveLength(0);
      expect(mockRepo.save).toHaveBeenCalled();
    });

    it('moves partial items up to cap', async () => {
      const overflowItems = Array.from({ length: 10 }, (_, i) => ({ entityId: i }));
      const vaultItems = Array.from({ length: VAULT_MAX_SLOTS - 2 }, (_, i) => ({ entityId: i + 100 }));
      
      const mockProfile = { 
        sessionId, 
        vault: vaultItems, 
        overflow: overflowItems 
      } as any;
      (mockRepo.load as any).mockResolvedValue(mockProfile);

      const result = await moveOverflowToVault(mockRepo, sessionId);

      expect(result.moved).toBe(2);
      expect(result.remaining).toBe(8);
      expect(mockProfile.vault).toHaveLength(VAULT_MAX_SLOTS);
      expect(mockProfile.overflow).toHaveLength(8);
      expect(mockRepo.save).toHaveBeenCalled();
    });
  });

  describe('hasOverflow', () => {
    it('returns true if overflow has items', async () => {
      (mockRepo.load as any).mockResolvedValue({ overflow: [1] });
      expect(await hasOverflow(mockRepo, sessionId)).toBe(true);
    });

    it('returns false if overflow is empty', async () => {
      (mockRepo.load as any).mockResolvedValue({ overflow: [] });
      expect(await hasOverflow(mockRepo, sessionId)).toBe(false);
    });
  });
});
