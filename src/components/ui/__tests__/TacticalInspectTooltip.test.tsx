import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TacticalInspectTooltip } from '../TacticalInspectTooltip';
import { gameStore } from '@/game/ui/store';

describe('TacticalInspectTooltip Component', () => {
  beforeEach(() => {
    gameStore.getState().resetRunStats();
    gameStore.getState().setHoveredEntity(null);
  });

  it('renders null when no entity is hovered', () => {
    const { container } = render(<TacticalInspectTooltip />);
    expect(container.firstChild).toBeNull();
  });

  it('renders enemy information with threat badge and hp bar when hovering hostile', () => {
    gameStore.getState().setHoveredEntity({
      type: 'enemy',
      name: 'NULL-POINTER SPECTER',
      kanjiSub: '虚無ポインタ',
      subTitle: 'CORRUPTED MEMORY SPECTER',
      badge: 'HOSTILE TARGET',
      badgeVariant: 'danger',
      description: 'Hostile machine construct actively pursuing chassis termination.',
      hp: 6,
      maxHp: 10,
      interactionHint: '[BUMP] to execute melee attack',
      screenX: 200,
      screenY: 200,
      gridX: 5,
      gridY: 7,
    });

    render(<TacticalInspectTooltip />);

    expect(screen.getByRole('tooltip')).toBeDefined();
    expect(screen.getByText('NULL-POINTER SPECTER')).toBeDefined();
    expect(screen.getByText('HOSTILE TARGET')).toBeDefined();
    expect(screen.getByText('6 / 10 HP')).toBeDefined();
    expect(screen.getByText('[BUMP] to execute melee attack')).toBeDefined();
    expect(screen.getByText(/GRID \(5, 7\)/)).toBeDefined();
  });

  it('renders forensic lore text block when flavorText is present', () => {
    gameStore.getState().setHoveredEntity({
      type: 'tile',
      name: 'REINFORCED PLASTEEL BULKHEAD',
      kanjiSub: '耐圧隔壁',
      subTitle: 'STRUCTURAL BLAST BARRIER',
      badge: 'IMPASSABLE',
      badgeVariant: 'cyan',
      description: 'High-density composite blast partition with internal shock dampening.',
      flavorText: 'Constructed during the Megacorp expansion era to survive explosive decompressions.',
      interactionHint: 'Structural obstacle (Blocks movement & LOS)',
      screenX: 150,
      screenY: 150,
      gridX: 2,
      gridY: 3,
      isDetailedOnly: true,
    });

    render(<TacticalInspectTooltip />);

    expect(screen.getByText('REINFORCED PLASTEEL BULKHEAD')).toBeDefined();
    expect(screen.getByText('FORENSIC ARCHIVE // LORE')).toBeDefined();
    expect(
      screen.getByText('Constructed during the Megacorp expansion era to survive explosive decompressions.'),
    ).toBeDefined();
  });

  it('renders status effects when present', () => {
    gameStore.getState().setHoveredEntity({
      type: 'enemy',
      name: 'FRAGMENTER DRONE',
      badge: 'HOSTILE TARGET',
      badgeVariant: 'danger',
      statusEffects: ['BLEED', 'OVERHEAT'],
      screenX: 100,
      screenY: 100,
      gridX: 4,
      gridY: 4,
    });

    render(<TacticalInspectTooltip />);

    expect(screen.getByText('BLEED')).toBeDefined();
    expect(screen.getByText('OVERHEAT')).toBeDefined();
  });
});
