import { describe, it, expect, vi } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import { PlayerHUD } from '../PlayerHUD';
import { gameStore } from '@/game/ui/store';
import React from 'react';

// Mock Lucide icons
vi.mock('lucide-react', () => ({
  Heart: () => <div data-testid="icon-heart" />,
  Trophy: () => <div data-testid="icon-trophy" />,
  Zap: () => <div data-testid="icon-zap" />,
  Coins: () => <div data-testid="icon-coins" />,
  Shield: () => <div data-testid="icon-shield" />,
  Thermometer: () => <div data-testid="icon-thermometer" />,
  Brain: () => <div data-testid="icon-brain" />,
  Cpu: () => <div data-testid="icon-cpu" />,
}));

describe('PlayerHUD', () => {
  it('renders player stats from store', () => {
    act(() => {
      gameStore.setState({
        player: {
          hp: 10,
          maxHp: 20,
          xp: 30,
          level: 3,
          statuses: ['Poisoned'],
          heat: 0,
          maxHeat: 100,
          shellName: 'VANGUARD-v1',
          mods: []
        }
      });
    });

    render(<PlayerHUD />);

    expect(screen.getByText(/10\s*\/\s*20/)).toBeDefined();
    expect(screen.getByText('3')).toBeDefined();
    expect(screen.getByText(/30\s*\/\s*300/)).toBeDefined();
    expect(screen.getByText(/poisoned/i)).toBeDefined();
  });

  it('updates when store changes', async () => {
    act(() => {
      gameStore.setState({
        player: { hp: 5, maxHp: 10, xp: 0, level: 1, statuses: [], heat: 0, maxHeat: 100, shellName: 'VANGUARD-v1', mods: [] }
      });
    });

    render(<PlayerHUD />);
    expect(screen.getByText(/5\s*\/\s*10/)).toBeDefined();

    act(() => {
      gameStore.setState({
        player: { hp: 2, maxHp: 10, xp: 0, level: 1, statuses: [], heat: 0, maxHeat: 100, shellName: 'VANGUARD-v1', mods: [] }
      });
    });

    // Zustand usually triggers re-render automatically, so we just check again
    await waitFor(() => {
      expect(screen.getByText(/2\s*\/\s*10/)).toBeDefined();
    });
  });
});
