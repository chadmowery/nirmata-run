import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PlayerHUD } from '../PlayerHUD';
import { gameStore } from '@/game/ui/store';
import React from 'react';

// Mock Lucide icons
vi.mock('lucide-react', () => ({
  Heart: () => <div data-testid="icon-heart" />,
  Trophy: () => <div data-testid="icon-trophy" />,
  Zap: () => <div data-testid="icon-zap" />,
}));

describe('PlayerHUD', () => {
  it('renders player stats from store', () => {
    gameStore.setState({
      player: {
        hp: 10,
        maxHp: 20,
        xp: 30,
        level: 3,
        statuses: ['Poisoned'],
      }
    });

    render(<PlayerHUD />);

    expect(screen.getByText('10 / 20')).toBeDefined();
    expect(screen.getByText('3')).toBeDefined();
    expect(screen.getByText('30 / 300')).toBeDefined();
    expect(screen.getByText('POISONED')).toBeDefined();
  });

  it('updates when store changes', () => {
    gameStore.setState({
      player: { hp: 5, maxHp: 10, xp: 0, level: 1, statuses: [] }
    });

    const { rerender } = render(<PlayerHUD />);
    expect(screen.getByText('5 / 10')).toBeDefined();

    gameStore.setState({
      player: { hp: 2, maxHp: 10, xp: 0, level: 1, statuses: [] }
    });

    // Zustand usually triggers re-render automatically, so we just check again
    expect(screen.getByText('2 / 10')).toBeDefined();
  });
});
