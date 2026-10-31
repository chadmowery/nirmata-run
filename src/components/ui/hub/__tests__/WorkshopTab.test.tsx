import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { WorkshopTab } from '../WorkshopTab';
import { gameStore } from '@/game/ui/store';
import { createDefaultProfile } from '@/shared/profile';

describe('WorkshopTab Scrap to Flux Compression', () => {
  const sessionId = 'test-workshop-session';

  beforeEach(() => {
    vi.restoreAllMocks();

    const profile = createDefaultProfile(sessionId);
    profile.wallet.scrap = 250;
    profile.wallet.flux = 5;

    gameStore.setState({
      playerProfile: profile,
    });

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          scrapCost: 100,
          fluxGained: 1,
          wallet: { scrap: 150, flux: 6 },
        }),
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders compression section with balances and lever button', () => {
    render(<WorkshopTab />);

    expect(screen.getByText(/SCRAP RECYCLING & SALVAGE/i)).toBeDefined();
    expect(screen.getByText(/100 CR : 1 FLX/i)).toBeDefined();
    expect(screen.getByText('COMPRESS 1 FLUX')).toBeDefined();
  });

  it('disables compression button if scrap is below 100', () => {
    const profile = createDefaultProfile(sessionId);
    profile.wallet.scrap = 50;
    profile.wallet.flux = 5;
    gameStore.setState({ playerProfile: profile });

    render(<WorkshopTab />);

    const button = screen.getByRole('button', { name: /COMPRESS 1 FLUX/i });
    expect(button.hasAttribute('disabled')).toBe(true);
  });

  it('successfully compresses 100 scrap to 1 flux on click', async () => {
    render(<WorkshopTab />);

    const button = screen.getByRole('button', { name: /COMPRESS 1 FLUX/i });
    expect(button.hasAttribute('disabled')).toBe(false);

    fireEvent.click(button);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        '/api/economy/compress',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ sessionId, amount: 1 }),
        }),
      );
      expect(screen.getByText(/SUCCESS: Compressed 100 CR → \+1 FLX/i)).toBeDefined();
    });

    expect(gameStore.getState().playerProfile?.wallet.scrap).toBe(150);
    expect(gameStore.getState().playerProfile?.wallet.flux).toBe(6);
  });
});
