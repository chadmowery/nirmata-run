import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ShellTab } from '../ShellTab';
import { gameStore } from '@/game/ui/store';
import { PlayerProfile } from '@/shared/profile';

describe('ShellTab UI & Hologram Viewer', () => {
  let mockProfile: PlayerProfile;

  beforeEach(() => {
    vi.restoreAllMocks();

    mockProfile = {
      sessionId: 'test-session',
      wallet: { scrap: 500, flux: 100 },
      blueprintLibrary: [],
      installedItems: [],
      shellUpgrades: {},
      vault: [],
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
                baseStats: { maxHealth: 100, armor: 5, speed: 10, stability: 85 },
                basePorts: { maxFirmware: 2, maxAugment: 2, maxSoftware: 2 },
                upgrades: [],
                starterLoadout: ['phase-shift'],
              },
              {
                id: 'bastion-v1',
                name: 'Bastion V1',
                baseStats: { maxHealth: 140, armor: 8, speed: 8, stability: 95 },
                basePorts: { maxFirmware: 1, maxAugment: 3, maxSoftware: 2 },
                upgrades: [],
                starterLoadout: ['neural-spike'],
              },
              {
                id: 'ghost-v1',
                name: 'Ghost V1',
                baseStats: { maxHealth: 80, armor: 3, speed: 12, stability: 70 },
                basePorts: { maxFirmware: 3, maxAugment: 1, maxSoftware: 2 },
                upgrades: [],
                starterLoadout: ['extended-sight'],
              },
            ],
          }),
        } as unknown as Response;
      }
      return { ok: true, json: async () => ({}) } as unknown as Response;
    });
  });

  it('renders 1PX VECTOR WIREFRAME HOLOGRAM viewer with shell cards dock', async () => {
    render(<ShellTab />);

    await waitFor(() => {
      expect(screen.getAllByText(/1PX VECTOR WIREFRAME HOLOGRAM/i).length).toBeGreaterThan(0);
    });

    // Check shell cards inside hologram dock
    expect(screen.getByRole('button', { name: /Previous Shell/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /Next Shell/i })).toBeDefined();

    // Check that shell names appear in cards
    expect(screen.getAllByText(/Vanguard/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Bastion/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Ghost/i).length).toBeGreaterThan(0);

    // Initial selected shell is Vanguard -> should have active status tag
    expect(screen.getByText(/● ONLINE/i)).toBeDefined();
  });

  it('switches active shell on card click or navigation button', async () => {
    render(<ShellTab />);

    await waitFor(() => {
      expect(screen.getAllByText(/Vanguard/i).length).toBeGreaterThan(0);
    });

    // Click Next Shell button
    const nextBtn = screen.getByRole('button', { name: /Next Shell/i });
    fireEvent.click(nextBtn);

    // Selected shell should now be Bastion (index 1)
    expect(gameStore.getState().selectedShellIndex).toBe(1);

    // Click Previous Shell button
    const prevBtn = screen.getByRole('button', { name: /Previous Shell/i });
    fireEvent.click(prevBtn);

    expect(gameStore.getState().selectedShellIndex).toBe(0);
  });

  it('allows toggling rotation and resetting camera', async () => {
    render(<ShellTab />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /PAUSE ROT/i })).toBeDefined();
    });

    const rotBtn = screen.getByRole('button', { name: /PAUSE ROT/i });
    fireEvent.click(rotBtn);
    expect(screen.getByRole('button', { name: /RESUME ROT/i })).toBeDefined();

    const resetBtn = screen.getByRole('button', { name: /RESET CAM/i });
    fireEvent.click(resetBtn);
  });

  it('displays detailed stat tooltip when hovering over a chassis stat', async () => {
    render(<ShellTab />);

    await waitFor(() => {
      expect(screen.getByText('BASE SPEED')).toBeDefined();
    });

    const speedRow = screen.getByText('BASE SPEED');
    fireEvent.pointerEnter(speedRow, { clientX: 150, clientY: 200 });

    await waitFor(() => {
      expect(screen.getByText(/LOCOMOTION VELOCITY \/\/ 行動速度/i)).toBeDefined();
      expect(screen.getByText(/CHASSIS MOBILITY TELEMETRY/i)).toBeDefined();
    });

    fireEvent.pointerLeave(speedRow);
    await waitFor(() => {
      expect(screen.queryByText(/LOCOMOTION VELOCITY \/\/ 行動速度/i)).toBeNull();
    });
  });
});
