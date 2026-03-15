import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NearbyEntities } from '../NearbyEntities';
import { gameStore } from '@/game/ui/store';
import React from 'react';

// Mock Lucide icons
vi.mock('lucide-react', () => ({
  Eye: () => <div data-testid="icon-eye" />,
}));

describe('NearbyEntities', () => {
  it('renders visible entities from store', () => {
    gameStore.setState({
      visibleEntities: [
        { id: 10, name: 'Orc', hp: 5, maxHp: 10 },
      ],
    });

    render(<NearbyEntities />);

    expect(screen.getByText('Orc')).toBeDefined();
    expect(screen.getByText('VISIBLE THREATS')).toBeDefined();
  });

  it('renders nothing if no entities visible', () => {
    gameStore.setState({ visibleEntities: [] });
    const { container } = render(<NearbyEntities />);
    expect(container.firstChild).toBeNull();
  });
});
