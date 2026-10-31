import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ShellUpgradePanel } from '../ShellUpgradePanel';
import { gameStore } from '@/game/ui/store';

describe('ShellUpgradePanel Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/api/shells')) {
        return {
          ok: true,
          json: async () => ({
            templates: [
              {
                id: 'vanguard-v1',
                name: 'VANGUARD-v1',
                basePorts: { maxFirmware: 3, maxAugment: 2, maxSoftware: 1 },
              },
            ],
          }),
        };
      }
      return { ok: true, json: async () => ({}) };
    });

    gameStore.setState({
      selectedShellIndex: 0,
      playerProfile: {
        sessionId: 'test-session',
        wallet: { scrap: 500, flux: 1000 },
        blueprintLibrary: [],
        installedItems: [],
        shellUpgrades: {
          'vanguard-v1': {
            speed: 2,
            armor: 5, // Maxed!
            stability: 0,
            additionalPorts: 3, // Maxed!
          },
        },
        vault: [],
        overflow: [],
        attemptTracking: {
          weekNumber: 0,
          weeklyAttemptUsed: false,
          dayNumber: 0,
          dailyAttemptUsed: false,
        },
        weekSeed: 0,
        createdAt: Date.now(),
      },
    });
  });

  it('renders progress bar meters with correct levels and max markers', async () => {
    render(<ShellUpgradePanel />);

    // Speed: 2 / 5
    expect(await screen.findByText('LEVEL MK-2 / MK-5')).toBeDefined();

    // Armor: 5 / 5 [MAXED]
    expect(await screen.findByText('LEVEL MK-5 / MK-5')).toBeDefined();

    // Maxed badges
    const maxBadges = await screen.findAllByText('[MAXED]');
    expect(maxBadges.length).toBe(2); // armor and additionalPorts

    // Progress bars have correct accessibility attributes
    const progressBars = screen.getAllByRole('progressbar');
    expect(progressBars.length).toBe(4);
    expect(progressBars[0].getAttribute('aria-valuenow')).toBe('2');
    expect(progressBars[0].getAttribute('aria-valuemax')).toBe('5');
    expect(progressBars[1].getAttribute('aria-valuenow')).toBe('5');
    expect(progressBars[1].getAttribute('aria-valuemax')).toBe('5');
  });

  it('disables upgrade buttons and displays MAXED when a stat reaches its maximum level', async () => {
    render(<ShellUpgradePanel />);

    const buttons = await screen.findAllByRole('button');
    // Button for armor (index 1) should be disabled and say MAXED
    const armorButton = buttons.find((b) => b.textContent?.includes('MAX LEVEL') || b.textContent?.includes('MAXED'));
    expect(armorButton).toBeDefined();
    expect(armorButton?.hasAttribute('disabled')).toBe(true);
  });
});
