import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VaultTab } from '../VaultTab';
import { gameStore } from '@/game/ui/store';
import { PlayerProfile } from '@/shared/profile';

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
    fireEvent.click(loadBtn);

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
});
