import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as equipRoute } from '../equip-from-vault/route';
import { POST as socketRoute } from '../socket-software/route';
import { POST as uninstallRoute } from '../../economy/uninstall/route';
import { profileRepository } from '@/app/persistence/fs-profile-repository';
import { PlayerProfile } from '@/shared/profile';

describe('Vault Loadout & Software Socketing API', () => {
  let mockProfile: PlayerProfile;

  beforeEach(() => {
    mockProfile = {
      sessionId: 'test-session',
      wallet: { scrap: 500, flux: 100 },
      blueprintLibrary: [],
      installedItems: [],
      shellUpgrades: {},
      vault: [
        {
          entityId: 101,
          templateId: 'rifle-v1',
          itemType: 'weapon',
          rarityTier: 'common',
          extractedAtFloor: 1,
          extractedAtTimestamp: 1000,
        },
        {
          entityId: 102,
          templateId: 'armor-v1',
          itemType: 'armor',
          rarityTier: 'common',
          extractedAtFloor: 1,
          extractedAtTimestamp: 1000,
        },
        {
          entityId: 103,
          templateId: 'bleed-v1',
          itemType: 'software',
          rarityTier: 'uncommon',
          extractedAtFloor: 1,
          extractedAtTimestamp: 1000,
        },
        {
          entityId: 104,
          templateId: 'vampire-v1',
          itemType: 'software',
          rarityTier: 'uncommon',
          extractedAtFloor: 1,
          extractedAtTimestamp: 1000,
        },
      ],
      overflow: [],
      attemptTracking: {
        weekNumber: 0,
        weeklyAttemptUsed: false,
        dayNumber: 0,
        dailyAttemptUsed: false,
      },
      weekSeed: 0,
      createdAt: 1000,
    };

    vi.spyOn(profileRepository, 'load').mockImplementation(async () => mockProfile);
    vi.spyOn(profileRepository, 'save').mockImplementation(async (p) => {
      mockProfile = p;
    });
  });

  it('sockets offensive software onto weapon in vault', async () => {
    const req = new NextRequest('http://localhost/api/vault/socket-software', {
      method: 'POST',
      body: JSON.stringify({
        sessionId: 'test-session',
        targetEntityId: 101,
        softwareEntityId: 103, // bleed-v1
      }),
    });

    const res = await socketRoute(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);

    const weapon = mockProfile.vault.find((i) => i.entityId === 101);
    expect(weapon?.socketedSoftware).toEqual(['bleed-v1']);

    // Consumed software should be removed from vault
    const software = mockProfile.vault.find((i) => i.entityId === 103);
    expect(software).toBeUndefined();
  });

  it('rejects defensive software onto weapon', async () => {
    const req = new NextRequest('http://localhost/api/vault/socket-software', {
      method: 'POST',
      body: JSON.stringify({
        sessionId: 'test-session',
        targetEntityId: 101, // weapon
        softwareEntityId: 104, // vampire-v1 (armor only)
      }),
    });

    const res = await socketRoute(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('Incompatible software');
  });

  it('equips weapon and armor from vault onto shell loadout', async () => {
    // Equip weapon
    const reqWeapon = new NextRequest('http://localhost/api/vault/equip-from-vault', {
      method: 'POST',
      body: JSON.stringify({
        sessionId: 'test-session',
        shellId: 'vanguard-v1',
        entityId: 101,
        targetSlotType: 'weapon',
      }),
    });
    const resWeapon = await equipRoute(reqWeapon);
    expect(resWeapon.status).toBe(200);

    // Equip armor
    const reqArmor = new NextRequest('http://localhost/api/vault/equip-from-vault', {
      method: 'POST',
      body: JSON.stringify({
        sessionId: 'test-session',
        shellId: 'vanguard-v1',
        entityId: 102,
        targetSlotType: 'armor',
      }),
    });
    const resArmor = await equipRoute(reqArmor);
    expect(resArmor.status).toBe(200);

    expect(mockProfile.installedItems).toHaveLength(2);
    expect(mockProfile.installedItems[0].type).toBe('weapon');
    expect(mockProfile.installedItems[1].type).toBe('armor');
    expect(mockProfile.vault).toHaveLength(2); // 103 and 104 left
  });

  it('equips item into backpack loadout', async () => {
    const req = new NextRequest('http://localhost/api/vault/equip-from-vault', {
      method: 'POST',
      body: JSON.stringify({
        sessionId: 'test-session',
        shellId: 'vanguard-v1',
        entityId: 103, // bleed-v1
        targetSlotType: 'backpack',
      }),
    });
    const res = await equipRoute(req);
    expect(res.status).toBe(200);

    expect(mockProfile.installedItems).toHaveLength(1);
    expect(mockProfile.installedItems[0].type).toBe('backpack');
    expect(mockProfile.installedItems[0].blueprintId).toBe('bleed-v1');
  });

  it('uninstalls weapon from shell loadout and restores to vault with socketed software', async () => {
    mockProfile.vault = [];
    mockProfile.installedItems = [
      {
        entityId: 201,
        blueprintId: 'rifle-v1',
        type: 'weapon',
        shellId: 'vanguard-v1',
        isLegacy: false,
        socketedSoftware: ['bleed-v1'],
      },
    ];

    const req = new NextRequest('http://localhost/api/economy/uninstall', {
      method: 'POST',
      body: JSON.stringify({
        sessionId: 'test-session',
        entityId: 201,
        shellId: 'vanguard-v1',
      }),
    });

    const res = await uninstallRoute(req as unknown as Request);
    expect(res.status).toBe(200);
    expect(mockProfile.installedItems).toHaveLength(0);

    const restored = mockProfile.vault.find((i) => i.entityId === 201);
    expect(restored).toBeDefined();
    expect(restored?.socketedSoftware).toEqual(['bleed-v1']);
    expect(restored?.itemType).toBe('weapon');
  });
});
