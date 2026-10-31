import React from 'react';
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
            ...profile,
            vault: Array(30).fill({ entityId: 1, templateId: 'phase-shift', itemType: 'firmware' }),
            wallet: { scrap: 1000, flux: 1000 },
          },
        }),
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('toggles visibility with backtick key', () => {
    render(<DevTerminal />);

    // Initially hidden
    expect(screen.queryByText(/NIRMATA_RUN \/\/ AUTH_DEBUG_TERMINAL/i)).toBeNull();

    // Press ` to open
    fireEvent.keyDown(window, { key: '`', code: 'Backquote' });
    expect(screen.getByText(/NIRMATA_RUN \/\/ AUTH_DEBUG_TERMINAL/i)).toBeDefined();

    // Press Escape to close
    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });
    expect(screen.queryByText(/NIRMATA_RUN \/\/ AUTH_DEBUG_TERMINAL/i)).toBeNull();
  });

  it('executes /grant-all and outputs result lines', async () => {
    render(<DevTerminal />);

    // Open terminal
    fireEvent.keyDown(window, { key: '`', code: 'Backquote' });

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: '/grant-all' } });
    fireEvent.submit(input.closest('form')!);

    await waitFor(() => {
      expect(screen.getByText(/Granted 30 item\(s\) across all types to Vault/i)).toBeDefined();
      expect(screen.getByText(/Added 1000 Scrap and 1000 Flux to Wallet/i)).toBeDefined();
    });

    expect(fetch).toHaveBeenCalledWith(
      '/api/admin/grant-all',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ sessionId }),
      }),
    );
  });

  it('exposes window.grantAll and window.seedVault helpers', async () => {
    render(<DevTerminal />);

    expect(typeof (window as any).grantAll).toBe('function');
    expect(typeof (window as any).seedVault).toBe('function');

    const result = await (window as any).grantAll(sessionId);
    expect(result.success).toBe(true);
    expect(result.vaultCount).toBe(30);
  });
});
