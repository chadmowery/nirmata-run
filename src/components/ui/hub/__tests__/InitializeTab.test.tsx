import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { InitializeTab } from '../InitializeTab';
import { gameStore } from '@/game/ui/store';
import { RunMode } from '@/shared/run-mode';
import { createDefaultProfile } from '@/shared/profile';

describe('InitializeTab Loadout Preview', () => {
  beforeEach(() => {
    vi.restoreAllMocks();

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          modes: [
            {
              mode: RunMode.SIMULATION,
              available: true,
              name: 'Simulation Mode',
              description: 'Standard exploration protocol',
              attemptsRemaining: 'unlimited',
            },
          ],
        }),
      }),
    );

    const profile = createDefaultProfile('test-init-session');
    profile.installedItems = [
      {
        entityId: 991,
        blueprintId: 'phase-shift',
        type: 'firmware',
        shellId: 'vanguard-v1',
        isLegacy: false,
      },
      {
        entityId: 992,
        blueprintId: 'displacement-venting',
        type: 'augment',
        shellId: 'vanguard-v1',
        isLegacy: false,
      },
    ];

    gameStore.setState({
      playerProfile: profile,
      selectedShellIndex: 0,
      shellTemplates: [
        {
          id: 'vanguard-v1',
          name: 'VANGUARD-v1',
          baseStats: { speed: 120, stability: 100, armor: 1, maxHealth: 20 },
          basePorts: { maxFirmware: 2, maxAugment: 1, maxSoftware: 2 },
          starterLoadout: ['basic-strike', 'kinetic-link'],
          upgrades: [],
        },
      ],
      selectedRunMode: RunMode.SIMULATION,
      modeAvailability: [
        {
          mode: RunMode.SIMULATION,
          available: true,
          name: 'Simulation Mode',
          description: 'Standard exploration protocol',
          attemptsRemaining: 'unlimited',
          reason: null,
        },
      ],
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders deployment protocol commitment with deployed hardware manifest', () => {
    render(<InitializeTab />);

    expect(screen.getByText(/DEPLOYMENT PROTOCOL COMMITMENT/i)).toBeDefined();
    expect(screen.getByText(/DEPLOYED HARDWARE MANIFEST/i)).toBeDefined();
    expect(screen.getByText(/UNSECURED HARDWARE FORFEITED ON TERMINATION/i)).toBeDefined();

    // Verify 2-letter abbreviation badges from ItemIcon
    expect(screen.getByText('PS')).toBeDefined(); // Phase Shift
    expect(screen.getByText('DV')).toBeDefined(); // Displacement Venting
  });

  it('falls back to chassis default firmware when no custom firmware installed', () => {
    const profile = createDefaultProfile('test-init-session-2');
    profile.installedItems = []; // Empty installed items
    gameStore.setState({ playerProfile: profile });

    render(<InitializeTab />);

    expect(screen.getByText(/SECURED BASELINE LOADOUT/i)).toBeDefined();
    expect(screen.getByText('BS')).toBeDefined(); // Basic Strike
    expect(screen.getByText('KL')).toBeDefined(); // Kinetic Link
  });

  it('shows rich ItemTooltip when hovering an item in the loadout preview', () => {
    render(<InitializeTab />);

    const itemCard = screen.getByText('PS').closest('div[tabindex="0"]');
    expect(itemCard).toBeDefined();

    fireEvent.pointerEnter(itemCard!, { clientX: 200, clientY: 300 });

    const tooltip = screen.getByRole('tooltip');
    expect(tooltip).toBeDefined();
    expect(screen.getAllByText(/Phase_Shift\.sh/i).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/THERMAL GENERATION/i)).toBeDefined();
  });
});
