import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LoadoutTab } from '../LoadoutTab';
import { gameStore } from '@/game/ui/store';
import { PlayerProfile } from '@/shared/profile';

describe('LoadoutTab UI', () => {
  let mockProfile: PlayerProfile;

  beforeEach(() => {
    vi.restoreAllMocks();

    mockProfile = {
      sessionId: 'test-session',
      wallet: { scrap: 500, flux: 100 },
      blueprintLibrary: [],
      installedItems: [
        {
          entityId: 101,
          blueprintId: 'rifle-v1',
          type: 'weapon',
          shellId: 'vanguard-v1',
          isLegacy: false,
          socketedSoftware: ['bleed-v1'],
        },
        {
          entityId: 102,
          blueprintId: 'armor-v1',
          type: 'armor',
          shellId: 'vanguard-v1',
          isLegacy: false,
        },
      ],
      shellUpgrades: {},
      vault: [
        {
          entityId: 201,
          templateId: 'bleed-v1',
          itemType: 'software',
          rarityTier: 'uncommon',
          extractedAtFloor: 1,
          extractedAtTimestamp: 1000,
        },
        {
          entityId: 202,
          templateId: 'rifle-v2',
          itemType: 'weapon',
          rarityTier: 'uncommon',
          extractedAtFloor: 2,
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

    // Mock shells endpoint
    vi.spyOn(global, 'fetch').mockImplementation(async (url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.includes('/api/shells')) {
        return {
          ok: true,
          json: async () => ({
            templates: [
              {
                id: 'vanguard-v1',
                name: 'Vanguard V1',
                baseStats: { maxHealth: 100, armor: 5, speed: 10, stability: 100 },
                basePorts: { maxFirmware: 2, maxAugment: 2, maxSoftware: 2 },
                upgrades: [],
                starterLoadout: ['phase-shift'],
              },
            ],
          }),
        } as unknown as Response;
      }
      return { ok: true, json: async () => ({}) } as unknown as Response;
    });
  });

  it('renders installed hardware matrix with weapon, armor, and backpack slots', async () => {
    render(<LoadoutTab />);

    await waitFor(() => {
      expect(screen.getByText('PRIMARY WEAPON')).toBeDefined();
      expect(screen.getByText('TACTICAL ARMOR')).toBeDefined();
      expect(screen.getByText('RUN BACKPACK (RESERVE)')).toBeDefined();
    });
  });

  it('filters reserve stash by weapon and armor', async () => {
    render(<LoadoutTab />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'WEAPON' })).toBeDefined();
      expect(screen.getByRole('button', { name: 'ARMOR' })).toBeDefined();
    });

    // Click WEAPON filter
    fireEvent.click(screen.getByRole('button', { name: 'WEAPON' }));
    expect(screen.getByText(/RIFLE-V2/i)).toBeDefined();
    expect(screen.queryByText(/BLEED-V1/i)).toBeNull();
  });

  it('renders all reserve stash items in scroll container when ALL filter is selected', async () => {
    // Add 10 items to vault
    const extraVault = Array.from({ length: 10 }, (_, i) => ({
      entityId: 99000 + i,
      templateId: `item-${i}`,
      itemType: 'software' as const,
      rarityTier: 'common',
      extractedAtFloor: 1,
      extractedAtTimestamp: 1000,
    }));

    gameStore.getState().updateProfileOptimistic((prev) => ({
      ...prev,
      vault: [...prev.vault, ...extraVault],
    }));

    render(<LoadoutTab />);

    await waitFor(() => {
      expect(screen.getByText('RESERVE HARDWARE STASH')).toBeDefined();
    });

    // Check that items are rendered
    expect(screen.getByText(/bleed-v1/i)).toBeDefined();
    expect(screen.getByText(/rifle-v2/i)).toBeDefined();
    expect(screen.getByText(/item-0/i)).toBeDefined();
    expect(screen.getByText(/item-9/i)).toBeDefined();
  });
});
