import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { InRunItemTooltip } from './InRunItemTooltip';
import { EquipmentDef, SoftwareDef } from '@shared/components';

describe('InRunItemTooltip', () => {
  it('renders basic stats by default', () => {
    (window as any).gameContext = {
      world: {
        getComponent: vi.fn().mockImplementation((id, def) => {
          if (def === EquipmentDef) {
            return { name: 'Test Item', tier: 'Rare' };
          }
          return undefined;
        }),
      },
    };
    render(<InRunItemTooltip entityId={1} />);
    expect(screen.getByText('Test Item')).toBeDefined();
    expect(screen.getByText('Tier: Rare')).toBeDefined();
  });

  it('renders expanded deep stats when Alt is held', () => {
    (window as any).gameContext = {
      world: {
        getComponent: vi.fn().mockImplementation((id, def) => {
          if (def === EquipmentDef) {
            return { name: 'Test Item', tier: 'Rare' };
          }
          if (def === SoftwareDef) {
            return { modifier: 'Fire Rate +5%' };
          }
          return undefined;
        }),
      },
    };
    render(<InRunItemTooltip entityId={1} />);
    fireEvent.keyDown(window, { key: 'Alt' });
    expect(screen.getByText('Deeper stats here...')).toBeDefined();
  });
});
