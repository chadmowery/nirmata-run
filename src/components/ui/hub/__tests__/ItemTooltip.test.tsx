import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ItemTooltip } from '../ItemTooltip';
import { resolveItemMetadata } from '../item-metadata';
import { VaultItem } from '@/shared/profile';

describe('ItemTooltip Component', () => {
  it('renders nothing when visible is false', () => {
    const meta = resolveItemMetadata({ templateId: 'phase-shift' });
    render(
      <ItemTooltip
        metadata={meta}
        position={{ x: 100, y: 100 }}
        visible={false}
      />,
    );

    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('renders rich metadata details when visible is true', () => {
    const meta = resolveItemMetadata({
      templateId: 'neural-spike',
      compiledAt: 1700000000000,
    });

    render(
      <ItemTooltip
        metadata={meta}
        position={{ x: 200, y: 150 }}
        visible={true}
      />,
    );

    const tooltip = screen.getByRole('tooltip');
    expect(tooltip).toBeDefined();
    expect(screen.getByText('Neural_Spike.exe')).toBeDefined();
    expect(screen.getByText(/COMPILED/i)).toBeDefined();
    expect(screen.getByText(/Direct wireless logic spike/i)).toBeDefined();
    expect(screen.getByText('THERMAL GENERATION')).toBeDefined();
    expect(screen.getByText('+40 HEAT')).toBeDefined();
  });

  it('automatically resolves metadata from a VaultItem prop', () => {
    const vaultItem: VaultItem = {
      entityId: 90021,
      templateId: 'displacement-venting',
      rarityTier: 'uncommon',
      itemType: 'augment',
      extractedAtFloor: 4,
      extractedAtTimestamp: Date.now(),
    };

    render(
      <ItemTooltip
        item={vaultItem}
        position={{ x: 100, y: 100 }}
        visible={true}
      />,
    );

    expect(screen.getByText('Displacement_Venting.arc')).toBeDefined();
    expect(screen.getByText(/AUGMENT \/\//i)).toBeDefined();
    expect(screen.getByText('TRIGGER CONDITION')).toBeDefined();
    expect(screen.getByText('ON ACTIVATION')).toBeDefined();
    expect(screen.getByText('HARVEST SUB-LEVEL')).toBeDefined();
    expect(screen.getByText('FLOOR 4')).toBeDefined();
  });

  it('invokes onDismiss callback when Escape key is pressed', () => {
    const onDismiss = vi.fn();
    const meta = resolveItemMetadata({ templateId: 'bleed-v0' });

    render(
      <ItemTooltip
        metadata={meta}
        position={{ x: 100, y: 100 }}
        visible={true}
        onDismiss={onDismiss}
      />,
    );

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('renders loaded software modifiers preview when item has socketed software', () => {
    const vaultItem: VaultItem = {
      entityId: 90022,
      templateId: 'rifle-v1',
      rarityTier: 'common',
      itemType: 'equipment',
      extractedAtFloor: 2,
      extractedAtTimestamp: Date.now(),
      socketedSoftware: ['bleed-v2'],
    };

    render(
      <ItemTooltip
        item={vaultItem}
        position={{ x: 100, y: 100 }}
        visible={true}
      />,
    );

    expect(screen.getByText('Standard Kinetic Rifle')).toBeDefined();
    expect(screen.getByText(/LOADED SOFTWARE SUBROUTINE \/\/ MODIFIERS/i)).toBeDefined();
    expect(screen.getAllByText(/BLEED\.EXE V2/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Inflicts \+5 DoT Bleed damage/i).length).toBeGreaterThanOrEqual(1);
  });
});
