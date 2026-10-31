import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { VaultTab, sortVaultItems, getVaultItemValue } from '../VaultTab';
import { gameStore } from '@/game/ui/store';
import { PlayerProfile, VaultItem } from '@/shared/profile';

describe('Vault Sorting Logic (sortVaultItems & getVaultItemValue)', () => {
  const sampleItems: VaultItem[] = [
    {
      entityId: 1,
      templateId: 'rifle-v1',
      itemType: 'weapon',
      rarityTier: 'common',
      extractedAtFloor: 1,
      extractedAtTimestamp: 1000,
    },
    {
      entityId: 2,
      templateId: 'bleed-v1',
      itemType: 'software',
      rarityTier: 'uncommon',
      extractedAtFloor: 1,
      extractedAtTimestamp: 1000,
    },
    {
      entityId: 3,
      templateId: 'phased-overdrive',
      itemType: 'augment',
      rarityTier: 'legendary',
      extractedAtFloor: 2,
      extractedAtTimestamp: 1000,
    },
    {
      entityId: 4,
      templateId: 'armor-v3',
      itemType: 'armor',
      rarityTier: 'rare',
      extractedAtFloor: 3,
      extractedAtTimestamp: 1000,
      socketedSoftware: ['bleed-v3'],
    },
    {
      entityId: 5,
      templateId: 'phase-shift',
      itemType: 'firmware',
      rarityTier: 'common',
      extractedAtFloor: 1,
      extractedAtTimestamp: 1000,
    },
  ];

  it('calculates dynamic salvage value including socketed software bonuses', () => {
    // common item: 15
    expect(getVaultItemValue(sampleItems[0])).toBe(15);
    // uncommon item: 30
    expect(getVaultItemValue(sampleItems[1])).toBe(30);
    // legendary item: 150
    expect(getVaultItemValue(sampleItems[2])).toBe(150);
    // rare item (60) + bleed-v3 (+60): 120
    expect(getVaultItemValue(sampleItems[3])).toBe(120);
  });

  it('preserves default cargo bay order when sortField is default', () => {
    const sorted = sortVaultItems(sampleItems, 'default', 'desc');
    expect(sorted.map((i) => i.entityId)).toEqual([1, 2, 3, 4, 5]);
  });

  it('sorts by rarity in descending and ascending order', () => {
    const desc = sortVaultItems(sampleItems, 'rarity', 'desc');
    expect(desc.map((i) => i.rarityTier)).toEqual([
      'legendary',
      'rare',
      'uncommon',
      'common',
      'common',
    ]);
    expect(desc[0].templateId).toBe('phased-overdrive');
    expect(desc[1].templateId).toBe('armor-v3');
    expect(desc[2].templateId).toBe('bleed-v1');

    const asc = sortVaultItems(sampleItems, 'rarity', 'asc');
    expect(asc.map((i) => i.rarityTier)).toEqual([
      'common',
      'common',
      'uncommon',
      'rare',
      'legendary',
    ]);
    expect(asc[4].templateId).toBe('phased-overdrive');
  });

  it('sorts by type in descending (tactical: weapon > armor > firmware > augment > software) and ascending order', () => {
    const desc = sortVaultItems(sampleItems, 'type', 'desc');
    expect(desc.map((i) => i.itemType)).toEqual([
      'weapon',
      'armor',
      'firmware',
      'augment',
      'software',
    ]);

    const asc = sortVaultItems(sampleItems, 'type', 'asc');
    expect(asc.map((i) => i.itemType)).toEqual([
      'software',
      'augment',
      'firmware',
      'armor',
      'weapon',
    ]);
  });

  it('sorts by value in descending (highest scrap first) and ascending order', () => {
    const desc = sortVaultItems(sampleItems, 'value', 'desc');
    // Values: phased-overdrive (150), armor-v3+sw (120), bleed-v1 (30), rifle-v1 (15), phase-shift (15)
    expect(desc.map((i) => i.templateId)).toEqual([
      'phased-overdrive',
      'armor-v3',
      'bleed-v1',
      'phase-shift',
      'rifle-v1',
    ]);

    const asc = sortVaultItems(sampleItems, 'value', 'asc');
    expect(asc.map((i) => getVaultItemValue(i))).toEqual([15, 15, 30, 120, 150]);
  });
});

describe('VaultTab UI', () => {
  let mockProfile: PlayerProfile;

  beforeEach(() => {
    vi.restoreAllMocks();

    mockProfile = {
      sessionId: 'test-session',
      wallet: { scrap: 500, flux: 100 },
      blueprintLibrary: [],
      installedItems: [],
      shellUpgrades: {},
      vault: [
        {
          entityId: 301,
          templateId: 'rifle-v1',
          itemType: 'weapon',
          rarityTier: 'common',
          extractedAtFloor: 1,
          extractedAtTimestamp: 1000,
        },
        {
          entityId: 302,
          templateId: 'bleed-v1',
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

    gameStore.getState().setPlayerProfile(mockProfile);
  });

  it('renders cargo bay matrix and selects weapon to inspect telemetry', () => {
    render(<VaultTab />);

    expect(screen.getByText(/CARGO BAYS/i)).toBeDefined();
    expect(screen.getByText(/MANIFEST INSPECTOR/i)).toBeDefined();

    // Click on weapon slot
    const weaponSlot = screen.getByText('R1').closest('div');
    expect(weaponSlot).toBeDefined();
    fireEvent.click(weaponSlot!);

    // Manifest inspector should display weapon details and software socket action
    expect(screen.getByText('rifle-v1')).toBeDefined();
    expect(screen.getByText(/LOAD SOFTWARE SUBROUTINE/i)).toBeDefined();
    expect(screen.getByText(/BLEED-V1/i)).toBeDefined();
  });

  it('allows socketing software onto weapon directly from manifest inspector', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockImplementation(async (url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.includes('/api/vault/socket-software')) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            profile: {
              ...mockProfile,
              vault: [
                {
                  entityId: 301,
                  templateId: 'rifle-v1',
                  itemType: 'weapon',
                  rarityTier: 'common',
                  extractedAtFloor: 1,
                  extractedAtTimestamp: 1000,
                  socketedSoftware: ['bleed-v1'],
                },
              ],
            },
          }),
        } as unknown as Response;
      }
      return { ok: true, json: async () => ({}) } as unknown as Response;
    });

    render(<VaultTab />);

    // Click on weapon slot to inspect
    const weaponSlot = screen.getByText('R1').closest('div');
    fireEvent.click(weaponSlot!);

    // Click LOAD button for BLEED-V1
    const loadBtn = screen.getByRole('button', { name: /BLEED-V1/i });
    await act(async () => {
      fireEvent.click(loadBtn);
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/vault/socket-software',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          sessionId: 'test-session',
          targetEntityId: 301,
          softwareEntityId: 302,
        }),
      }),
    );
  });

  it('renders sort controls toolbar and toggles sorting directions and reset', () => {
    // Add 3rd item with high rarity/value
    mockProfile.vault.push({
      entityId: 303,
      templateId: 'phased-overdrive',
      itemType: 'augment',
      rarityTier: 'legendary',
      extractedAtFloor: 2,
      extractedAtTimestamp: 1000,
    });
    gameStore.getState().setPlayerProfile(mockProfile);

    render(<VaultTab />);

    expect(screen.getByText(/SORT CARGO:/i)).toBeDefined();
    const rarityBtn = screen.getByRole('button', { name: /Sort cargo by rarity/i });
    const typeBtn = screen.getByRole('button', { name: /Sort cargo by type/i });
    const valueBtn = screen.getByRole('button', { name: /Sort cargo by value/i });

    expect(rarityBtn).toBeDefined();
    expect(typeBtn).toBeDefined();
    expect(valueBtn).toBeDefined();
    // Initially default sort, no RESET button
    expect(screen.queryByRole('button', { name: /Reset cargo bay sort order/i })).toBeNull();

    // 1. Click RARITY -> should activate desc sort (▼)
    act(() => {
      fireEvent.click(rarityBtn);
    });
    expect(rarityBtn.textContent).toContain('RARITY ▼');
    const resetBtn = screen.getByRole('button', { name: /Reset cargo bay sort order/i });
    expect(resetBtn).toBeDefined();

    // In RARITY desc sort, legendary 'phased-overdrive' (icon PO) should be in slot A-01 (first cell)
    const allSlots = screen.getAllByText(/^[A-F]-0[1-8]$/);
    expect(allSlots[0].textContent).toBe('A-01');

    // 2. Click RARITY again -> should toggle to asc sort (▲)
    act(() => {
      fireEvent.click(rarityBtn);
    });
    expect(rarityBtn.textContent).toContain('RARITY ▲');

    // 3. Click TYPE -> should switch to TYPE desc (▼)
    act(() => {
      fireEvent.click(typeBtn);
    });
    expect(typeBtn.textContent).toContain('TYPE ▼');

    // 4. Click VALUE -> should switch to VALUE desc (▼)
    act(() => {
      fireEvent.click(valueBtn);
    });
    expect(valueBtn.textContent).toContain('VALUE ▼');

    // 5. Click RESET -> should restore default bay order and hide reset button
    act(() => {
      fireEvent.click(resetBtn);
    });
    expect(screen.queryByRole('button', { name: /Reset cargo bay sort order/i })).toBeNull();
  });

  it('displays dynamic scrap salvage values and salvages item from vault', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockImplementation(async (url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.includes('/api/vault/sell')) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            scrapGained: 15,
          }),
        } as unknown as Response;
      }
      return { ok: true, json: async () => ({}) } as unknown as Response;
    });

    render(<VaultTab />);

    // Click on weapon slot (rifle-v1, common, value 15 CR)
    const weaponSlot = screen.getByText('R1').closest('div');
    fireEvent.click(weaponSlot!);

    // Check spec row and button
    expect(screen.getByText('15 CR')).toBeDefined();
    const salvageBtn = screen.getByRole('button', { name: /SALVAGE FOR SCRAP/i });
    expect(salvageBtn.textContent).toContain('+15 CR');

    // Click salvage button
    await act(async () => {
      fireEvent.click(salvageBtn);
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/vault/sell',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          sessionId: 'test-session',
          entityId: 301,
        }),
      }),
    );

    // Profile wallet should have been updated optimistically: 500 + 15 = 515
    expect(gameStore.getState().playerProfile?.wallet.scrap).toBe(515);
  });
});
