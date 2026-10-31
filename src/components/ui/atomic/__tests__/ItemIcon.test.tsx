import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ItemIcon, getItemAbbreviation, getRarityColor } from '../ItemIcon';

describe('ItemIcon Component', () => {
  it('correctly maps known template IDs to 2-letter abbreviations', () => {
    expect(getItemAbbreviation('phase-shift')).toBe('PS');
    expect(getItemAbbreviation('neural-spike')).toBe('NS');
    expect(getItemAbbreviation('extended-sight')).toBe('ES');
    expect(getItemAbbreviation('basic-strike')).toBe('BS');
    expect(getItemAbbreviation('kinetic-link')).toBe('KL');
    expect(getItemAbbreviation('ghost-pulse')).toBe('GP');
    expect(getItemAbbreviation('logic-jam')).toBe('LJ');
    expect(getItemAbbreviation('displacement-venting')).toBe('DV');
    expect(getItemAbbreviation('static-siphon')).toBe('SS');
    expect(getItemAbbreviation('phased-overdrive')).toBe('PO');
    expect(getItemAbbreviation('bleed-v1')).toBe('B1');
    expect(getItemAbbreviation('rifle-v1')).toBe('R1');
    expect(getItemAbbreviation('armor-v2')).toBe('A2');
  });

  it('correctly generates abbreviations for custom or hyphenated names', () => {
    expect(getItemAbbreviation('cyber-deck')).toBe('CD');
    expect(getItemAbbreviation('plasma_coil')).toBe('PC');
    expect(getItemAbbreviation('quantum')).toBe('QU');
    expect(getItemAbbreviation(undefined, 'Tactical Boots')).toBe('TB');
  });

  it('resolves correct color according to rarity tier', () => {
    expect(getRarityColor('common')).toBe('#8A99AD');
    expect(getRarityColor('uncommon')).toBe('#00F0FF');
    expect(getRarityColor('rare')).toBe('#FFB800');
    expect(getRarityColor('legendary')).toBe('#FF0055');
  });

  it('renders icon with abbreviation and accessible label', () => {
    render(
      <ItemIcon
        templateId="neural-spike"
        itemType="firmware"
        rarityTier="uncommon"
        size="md"
      />,
    );

    expect(screen.getByText('NS')).toBeDefined();
    const container = screen.getByLabelText(/neural-spike \(firmware, uncommon\)/i);
    expect(container).toBeDefined();
  });

  it('supports hiding the abbreviation when showAbbreviation is false', () => {
    render(
      <ItemIcon
        templateId="phase-shift"
        itemType="firmware"
        showAbbreviation={false}
      />,
    );

    expect(screen.queryByText('PS')).toBeNull();
  });
});
