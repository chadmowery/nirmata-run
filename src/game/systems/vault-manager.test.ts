import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  inferItemType, 
  depositToOverflow, 
  discardOverflowItem, 
  sellOverflowItem, 
  moveOverflowToVault, 
  hasOverflow,
  VAULT_MAX_SLOTS,
  SELL_VALUES
} from './vault-manager';
import * as persistence from './profile-persistence';

vi.mock('./profile-persistence', () => ({
  loadProfile: vi.fn(),
  saveProfile: vi.fn(),
}));

describe('VaultManager', () => {
  const sessionId = 'test-session';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('inferItemType', () => {
    it('infers firmware from .sh, .exe, .sys', () => {
      expect(inferItemType('Phase_Shift.sh')).toBe('firmware');
      expect(inferItemType('Neural_Spike.exe')).toBe('firmware');
      expect(inferItemType('System_Core.sys')).toBe('firmware');
    });

    it('infers augment from .arc', () => {
      expect(inferItemType('Static_Siphon.arc')).toBe('augment');
    });

    it('infers software from other extensions', () => {
      expect(inferItemType('bleed-v0')).toBe('software');
      expect(inferItemType('vampire.msi')).toBe('software');
    });
  });

  describe('depositToOverflow', () => {
    it('appends items to overflow array', async () => {
      const mockProfile = { sessionId, overflow: [] } as any;
      (persistence.loadProfile as any).mockResolvedValue(mockProfile);

      const items = [
        { entityId: 1, templateId: 'test.sh', rarityTier: 'common', itemType: 'firmware', extractedAtFloor: 1, extractedAtTimestamp: Date.now() }
      ] as any;

      await depositToOverflow(sessionId, items);

      expect(mockProfile.overflow).toHaveLength(1);
      expect(mockProfile.overflow[0].entityId).toBe(1);
      expect(persistence.saveProfile).toHaveBeenCalledWith(mockProfile);
    });
  });

  describe('discardOverflowItem', () => {
    it('removes item from overflow and returns true', async () => {
      const mockProfile = { 
        sessionId, 
        overflow: [{ entityId: 1 }, { entityId: 2 }] 
      } as any;
      (persistence.loadProfile as any).mockResolvedValue(mockProfile);

      const result = await discardOverflowItem(sessionId, 1);

      expect(result).toBe(true);
      expect(mockProfile.overflow).toHaveLength(1);
      expect(mockProfile.overflow[0].entityId).toBe(2);
      expect(persistence.saveProfile).toHaveBeenCalledWith(mockProfile);
    });

    it('returns false if item not found', async () => {
      const mockProfile = { sessionId, overflow: [{ entityId: 2 }] } as any;
      (persistence.loadProfile as any).mockResolvedValue(mockProfile);

      const result = await discardOverflowItem(sessionId, 1);

      expect(result).toBe(false);
      expect(mockProfile.overflow).toHaveLength(1);
      expect(persistence.saveProfile).not.toHaveBeenCalled();
    });
  });

  describe('sellOverflowItem', () => {
    it('removes item and adds scrap based on rarity', async () => {
      const mockProfile = { 
        sessionId, 
        wallet: { scrap: 100 },
        overflow: [{ entityId: 1, rarityTier: 'uncommon' }] 
      } as any;
      (persistence.loadProfile as any).mockResolvedValue(mockProfile);

      const result = await sellOverflowItem(sessionId, 1);

      expect(result.success).toBe(true);
      expect(result.scrapGained).toBe(SELL_VALUES.uncommon);
      expect(mockProfile.wallet.scrap).toBe(100 + SELL_VALUES.uncommon);
      expect(mockProfile.overflow).toHaveLength(0);
      expect(persistence.saveProfile).toHaveBeenCalled();
    });

    it('respects scrap cap', async () => {
      const mockProfile = { 
        sessionId, 
        wallet: { scrap: 9990 },
        overflow: [{ entityId: 1, rarityTier: 'legendary' }] 
      } as any;
      (persistence.loadProfile as any).mockResolvedValue(mockProfile);

      const result = await sellOverflowItem(sessionId, 1);

      expect(result.success).toBe(true);
      expect(mockProfile.wallet.scrap).toBe(10000); // economy.caps.scrap is 10000
      expect(persistence.saveProfile).toHaveBeenCalled();
    });
  });

  describe('moveOverflowToVault', () => {
    it('moves all items if vault has room', async () => {
      const mockProfile = { 
        sessionId, 
        vault: [], 
        overflow: [{ entityId: 1 }, { entityId: 2 }] 
      } as any;
      (persistence.loadProfile as any).mockResolvedValue(mockProfile);

      const result = await moveOverflowToVault(sessionId);

      expect(result.moved).toBe(2);
      expect(result.remaining).toBe(0);
      expect(mockProfile.vault).toHaveLength(2);
      expect(mockProfile.overflow).toHaveLength(0);
      expect(persistence.saveProfile).toHaveBeenCalled();
    });

    it('moves partial items up to cap', async () => {
      const overflowItems = Array.from({ length: 10 }, (_, i) => ({ entityId: i }));
      const vaultItems = Array.from({ length: VAULT_MAX_SLOTS - 2 }, (_, i) => ({ entityId: i + 100 }));
      
      const mockProfile = { 
        sessionId, 
        vault: vaultItems, 
        overflow: overflowItems 
      } as any;
      (persistence.loadProfile as any).mockResolvedValue(mockProfile);

      const result = await moveOverflowToVault(sessionId);

      expect(result.moved).toBe(2);
      expect(result.remaining).toBe(8);
      expect(mockProfile.vault).toHaveLength(VAULT_MAX_SLOTS);
      expect(mockProfile.overflow).toHaveLength(8);
      expect(persistence.saveProfile).toHaveBeenCalled();
    });
  });

  describe('hasOverflow', () => {
    it('returns true if overflow has items', async () => {
      (persistence.loadProfile as any).mockResolvedValue({ overflow: [1] });
      expect(await hasOverflow(sessionId)).toBe(true);
    });

    it('returns false if overflow is empty', async () => {
      (persistence.loadProfile as any).mockResolvedValue({ overflow: [] });
      expect(await hasOverflow(sessionId)).toBe(false);
    });
  });
});
