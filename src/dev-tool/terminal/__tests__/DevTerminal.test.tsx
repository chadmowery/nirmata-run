import React from 'react';
import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DevTerminal } from '../DevTerminal';
import { gameStore } from '@/game/ui/store';
import { createDefaultProfile } from '@/shared/profile';

describe('DevTerminal Component', () => {
  const sessionId = 'test-terminal-session';

  beforeEach(() => {
    vi.restoreAllMocks();
    const profile = createDefaultProfile(sessionId);
    gameStore.getState().setPlayerProfile(profile);

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          result: {
            itemsGranted: 30,
            vaultFull: true,
            scrapAdded: 1000,
            fluxAdded: 1000,
          },
          vaultCount: 30,
          wallet: { scrap: 1000, flux: 1000 },
          profile: {
            sessionId,
            inventory: [],
            loadout: { primaryWeapon: null, secondaryWeapon: null, armor: null },
            vault: [],
            overflow: [],
            wallet: { scrap: 1000, flux: 1000 },
            selectedShellId: 'vanguard-v1',
            shells: ['vanguard-v1'],
            unlockedArchetypes: ['vanguard-v1'],
          },
        }),
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders and opens on backtick keydown', () => {
    render(<DevTerminal />);

    expect(screen.queryByPlaceholderText(/ENTER COMMAND/i)).not.toBeInTheDocument();

    fireEvent.keyDown(window, { key: '`' });

    expect(screen.getByPlaceholderText(/ENTER COMMAND/i)).toBeInTheDocument();
  });

  it('executes /grantall and updates history', async () => {
    render(<DevTerminal />);

    fireEvent.keyDown(window, { key: '`' });

    const input = screen.getByPlaceholderText(/ENTER COMMAND/i);
    fireEvent.change(input, { target: { value: '/grantall' } });
    fireEvent.submit(input.closest('form')!);

    await waitFor(() => {
      expect(screen.getByText(/Granted 30 item\(s\) across all types/i)).toBeInTheDocument();
      expect(screen.getByText(/Added 1000 Scrap and 1000 Flux/i)).toBeInTheDocument();
    });

    expect(fetch).toHaveBeenCalledWith(
      '/api/admin/grant-all',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      }),
    );
  });

  it('handles /grant-all and /seedvault aliases identically', async () => {
    render(<DevTerminal />);

    fireEvent.keyDown(window, { key: '`' });

    const input = screen.getByPlaceholderText(/ENTER COMMAND/i);
    fireEvent.change(input, { target: { value: '/seedvault' } });
    fireEvent.submit(input.closest('form')!);

    await waitFor(() => {
      expect(screen.getByText(/Granted 30 item\(s\) across all types/i)).toBeInTheDocument();
    });
  });

  it('executes /show-map command and invokes window.__DEBUG__.showMap', async () => {
    const showMapMock = vi.fn();
    (window as any).__DEBUG__ = {
      showMap: showMapMock,
    };

    render(<DevTerminal />);

    fireEvent.keyDown(window, { key: '`' });

    const input = screen.getByPlaceholderText(/ENTER COMMAND/i);
    fireEvent.change(input, { target: { value: '/show-map' } });
    fireEvent.submit(input.closest('form')!);

    await waitFor(() => {
      expect(showMapMock).toHaveBeenCalledTimes(1);
      expect(
        screen.getByText(/Floor map fully exposed and fog of war cleared/i),
      ).toBeInTheDocument();
    });

    delete (window as any).__DEBUG__;
  });

  it('executes /debug-ai command and invokes window.__DEBUG__.debugAI', async () => {
    const debugAIMock = vi.fn();
    (window as any).__DEBUG__ = {
      debugAI: debugAIMock,
    };

    render(<DevTerminal />);

    fireEvent.keyDown(window, { key: '`' });

    const input = screen.getByPlaceholderText(/ENTER COMMAND/i);
    fireEvent.change(input, { target: { value: '/debug-ai flee_from_target' } });
    fireEvent.submit(input.closest('form')!);

    await waitFor(() => {
      expect(debugAIMock).toHaveBeenCalledWith('flee_from_target');
      expect(
        screen.getByText(/AI Debug telemetry toggled \(flee_from_target\)/i),
      ).toBeInTheDocument();
    });

    delete (window as any).__DEBUG__;
  });
});
