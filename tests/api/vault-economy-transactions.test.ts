import { describe, it, expect, beforeEach, vi } from 'vitest';
import { POST as purchaseRoute } from '../../src/app/api/economy/purchase/route';
import { POST as uninstallRoute } from '../../src/app/api/economy/uninstall/route';
import { POST as sellRoute } from '../../src/app/api/vault/sell/route';
import { POST as discardRoute } from '../../src/app/api/vault/discard/route';
import { GET as overflowRoute } from '../../src/app/api/vault/overflow/route';
import { profileRepository } from '@/app/persistence/fs-profile-repository';
import { PlayerProfile, VaultItem, createDefaultProfile } from '@/shared/profile';
import { VAULT_MAX_SLOTS } from '@/shared/vault';

vi.mock('@/app/persistence/fs-profile-repository', () => ({
  profileRepository: {
    load: vi.fn(),
    save: vi.fn(),
  },
}));

describe('Vault & Economy Transactions API', () => {
  const sessionId = 'test-econ-session';

  const createMockProfile = (overrides?: Partial<PlayerProfile>): PlayerProfile => ({
    ...createDefaultProfile(sessionId),
    wallet: { scrap: 500, flux: 100 },
    vault: [],
    overflow: [],
    installedItems: [],
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/economy/purchase', () => {
    it('successfully purchases an item from shop, deducting scrap and adding to vault', async () => {
      const profile = createMockProfile({ wallet: { scrap: 500, flux: 0 } });
      vi.mocked(profileRepository.load).mockResolvedValue(profile);

      const req = new Request('http://localhost/api/economy/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          itemIndex: 0,
          weekSeed: 12345,
        }),
      });

      const res = await purchaseRoute(req);
      expect(res.status).toBe(200);
      const data = await res.json();

      expect(data.success).toBe(true);
      expect(data.purchased).toBeDefined();
      expect(data.remainingScrap).toBe(500 - data.purchased.price);
      expect(profile.vault).toHaveLength(1);
      expect(profile.vault[0].templateId).toBe(data.purchased.templateId);
      expect(profileRepository.save).toHaveBeenCalledWith(profile);
    });

    it('rejects purchase when scrap is insufficient', async () => {
      const profile = createMockProfile({ wallet: { scrap: 5, flux: 0 } });
      vi.mocked(profileRepository.load).mockResolvedValue(profile);

      const req = new Request('http://localhost/api/economy/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          itemIndex: 0,
          weekSeed: 12345,
        }),
      });

      const res = await purchaseRoute(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('Insufficient Scrap');
      expect(profileRepository.save).not.toHaveBeenCalled();
    });

    it('rejects purchase when vault is at max capacity', async () => {
      const fullVault: VaultItem[] = Array.from({ length: VAULT_MAX_SLOTS }, (_, i) => ({
        entityId: i + 1,
        templateId: 'test-item',
        rarityTier: 'common',
        itemType: 'software',
        extractedAtFloor: 1,
        extractedAtTimestamp: Date.now(),
      }));

      const profile = createMockProfile({
        wallet: { scrap: 1000, flux: 0 },
        vault: fullVault,
      });
      vi.mocked(profileRepository.load).mockResolvedValue(profile);

      const req = new Request('http://localhost/api/economy/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          itemIndex: 0,
          weekSeed: 12345,
        }),
      });

      const res = await purchaseRoute(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('Vault is full');
      expect(profileRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/economy/uninstall', () => {
    it('uninstalls item from shell and restores it to vault', async () => {
      const profile = createMockProfile({
        installedItems: [
          {
            entityId: 99,
            blueprintId: 'firewall-v1',
            shellId: 'vanguard-v1',
            type: 'software',
            isLegacy: false,
          },
        ],
        vault: [],
      });
      vi.mocked(profileRepository.load).mockResolvedValue(profile);

      const req = new Request('http://localhost/api/economy/uninstall', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          blueprintId: 'firewall-v1',
          shellId: 'vanguard-v1',
        }),
      });

      const res = await uninstallRoute(req);
      expect(res.status).toBe(200);
      const data = await res.json();

      expect(data.success).toBe(true);
      expect(profile.installedItems).toHaveLength(0);
      expect(profile.vault).toHaveLength(1);
      expect(profile.vault[0].templateId).toBe('firewall-v1');
      expect(profileRepository.save).toHaveBeenCalledWith(profile);
    });

    it('returns 400 when item is not installed on shell', async () => {
      const profile = createMockProfile({ installedItems: [] });
      vi.mocked(profileRepository.load).mockResolvedValue(profile);

      const req = new Request('http://localhost/api/economy/uninstall', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          blueprintId: 'non-existent',
          shellId: 'vanguard-v1',
        }),
      });

      const res = await uninstallRoute(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('not installed');
    });
  });

  describe('POST /api/vault/sell & /api/vault/discard', () => {
    it('sells item from overflow, adding scrap and removing from overflow', async () => {
      const overflowItem: VaultItem = {
        entityId: 42,
        templateId: 'test-software',
        rarityTier: 'rare',
        itemType: 'software',
        extractedAtFloor: 3,
        extractedAtTimestamp: Date.now(),
      };

      const profile = createMockProfile({
        wallet: { scrap: 100, flux: 0 },
        overflow: [overflowItem],
      });
      vi.mocked(profileRepository.load).mockResolvedValue(profile);

      const req = new Request('http://localhost/api/vault/sell', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          entityId: 42,
        }),
      });

      const res = await sellRoute(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();

      expect(data.success).toBe(true);
      expect(data.scrapGained).toBeGreaterThan(0);
      expect(profile.overflow).toHaveLength(0);
      expect(profile.wallet.scrap).toBe(100 + data.scrapGained);
      expect(profileRepository.save).toHaveBeenCalledWith(profile);
    });

    it('discards item from overflow without adding scrap', async () => {
      const overflowItem: VaultItem = {
        entityId: 42,
        templateId: 'junk-item',
        rarityTier: 'common',
        itemType: 'software',
        extractedAtFloor: 1,
        extractedAtTimestamp: Date.now(),
      };

      const profile = createMockProfile({
        wallet: { scrap: 100, flux: 0 },
        overflow: [overflowItem],
      });
      vi.mocked(profileRepository.load).mockResolvedValue(profile);

      const req = new Request('http://localhost/api/vault/discard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          entityId: 42,
        }),
      });

      const res = await discardRoute(req as any);
      expect(res.status).toBe(200);
      const data = await res.json();

      expect(data.success).toBe(true);
      expect(profile.overflow).toHaveLength(0);
      expect(profile.wallet.scrap).toBe(100); // unchanged
      expect(profileRepository.save).toHaveBeenCalledWith(profile);
    });

    it('returns 404 when item is not found in overflow', async () => {
      const profile = createMockProfile({ overflow: [] });
      vi.mocked(profileRepository.load).mockResolvedValue(profile);

      const req = new Request('http://localhost/api/vault/sell', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          entityId: 9999,
        }),
      });

      const res = await sellRoute(req as any);
      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/vault/overflow', () => {
    it('returns current overflow list and vault sizes', async () => {
      const profile = createMockProfile({
        vault: [
          {
            entityId: 1,
            templateId: 'v1',
            rarityTier: 'common',
            itemType: 'software',
            extractedAtFloor: 1,
            extractedAtTimestamp: 1,
          },
        ],
        overflow: [
          {
            entityId: 2,
            templateId: 'v2',
            rarityTier: 'rare',
            itemType: 'firmware',
            extractedAtFloor: 2,
            extractedAtTimestamp: 2,
          },
        ],
      });
      vi.mocked(profileRepository.load).mockResolvedValue(profile);

      const req = {
        nextUrl: new URL('http://localhost/api/vault/overflow?sessionId=test-econ-session'),
      } as any;

      const res = await overflowRoute(req);
      expect(res.status).toBe(200);
      const data = await res.json();

      expect(data.overflow).toHaveLength(1);
      expect(data.overflow[0].entityId).toBe(2);
      expect(data.vaultSize).toBe(1);
      expect(data.maxVaultSize).toBe(VAULT_MAX_SLOTS);
    });
  });
});
