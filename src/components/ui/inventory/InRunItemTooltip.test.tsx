import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { InRunItemTooltip } from './InRunItemTooltip';

describe('InRunItemTooltip', () => {
  it('renders basic stats by default', () => {
    (window as any).gameContext = {
      world: {
        getEntity: vi.fn().mockReturnValue({
          name: 'Test Item',
          getComponent: vi.fn().mockReturnValue({ tier: 'Rare' })
        })
      }
    };
    render(<InRunItemTooltip entityId={1} />);
    expect(screen.getByText('Test Item')).toBeDefined();
    expect(screen.getByText('Tier: Rare')).toBeDefined();
  });

  it('renders expanded deep stats when Alt is held', () => {
    (window as any).gameContext = {
      world: {
        getEntity: vi.fn().mockReturnValue({
          name: 'Test Item',
          getComponent: vi.fn().mockReturnValue({ tier: 'Rare', modifier: 'Fire Rate +5%' })
        })
      }
    };
    render(<InRunItemTooltip entityId={1} />);
    fireEvent.keyDown(window, { key: 'Alt' });
    expect(screen.getByText('Deeper stats here...')).toBeDefined();
  });
});
