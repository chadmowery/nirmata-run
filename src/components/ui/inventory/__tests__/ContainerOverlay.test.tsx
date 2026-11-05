import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ContainerOverlay, ContainerItem } from '../ContainerOverlay';

describe('ContainerOverlay Component', () => {
  let onClose: ReturnType<typeof vi.fn<() => void>>;
  let onTakeItem: ReturnType<typeof vi.fn<(item: ContainerItem) => void>>;
  let onStoreItem: ReturnType<typeof vi.fn<(item: ContainerItem) => void>>;

  const mockContainerItems: ContainerItem[] = [
    { id: 101, templateId: 'rifle-v2', name: 'Rifle Mk.II', rarityTier: 'rare', type: 'weapon' },
    { id: 102, templateId: 'bleed-v1', name: 'Bleed.exe', rarityTier: 'common', type: 'software' },
  ];

  const mockBackpackItems: ContainerItem[] = [
    { id: 201, templateId: 'armor-v1', name: 'Carbon Fiber Vest', rarityTier: 'common', type: 'armor' },
  ];

  beforeEach(() => {
    onClose = vi.fn<() => void>();
    onTakeItem = vi.fn<(item: ContainerItem) => void>();
    onStoreItem = vi.fn<(item: ContainerItem) => void>();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders modal dialog with container name and placard', () => {
    render(
      <ContainerOverlay
        containerEntityId={99}
        containerName="Zero-Day Core Safe"
        containerItems={mockContainerItems}
        backpackItems={mockBackpackItems}
        onClose={onClose}
        onTakeItem={onTakeItem}
        onStoreItem={onStoreItem}
      />,
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeDefined();
    expect(screen.getByText('ZERO-DAY CORE SAFE')).toBeDefined();
    expect(screen.getByText('2 ITEMS')).toBeDefined();
    expect(screen.getByText('1 SLOTS')).toBeDefined();
  });

  it('renders container items and backpack items properly', () => {
    render(
      <ContainerOverlay
        containerEntityId={99}
        containerItems={mockContainerItems}
        backpackItems={mockBackpackItems}
        onClose={onClose}
        onTakeItem={onTakeItem}
        onStoreItem={onStoreItem}
      />,
    );

    expect(screen.getByText('Rifle Mk.II')).toBeDefined();
    expect(screen.getByText('Bleed.exe')).toBeDefined();
    expect(screen.getByText('Carbon Fiber Vest')).toBeDefined();
  });

  it('calls onTakeItem when TAKE button is clicked', () => {
    render(
      <ContainerOverlay
        containerEntityId={99}
        containerItems={mockContainerItems}
        backpackItems={mockBackpackItems}
        onClose={onClose}
        onTakeItem={onTakeItem}
        onStoreItem={onStoreItem}
      />,
    );

    const takeButtons = screen.getAllByText('TAKE');
    expect(takeButtons.length).toBe(2);

    fireEvent.click(takeButtons[0]);
    expect(onTakeItem).toHaveBeenCalledWith(mockContainerItems[0]);
  });

  it('calls onStoreItem when STORE button is clicked', () => {
    render(
      <ContainerOverlay
        containerEntityId={99}
        containerItems={mockContainerItems}
        backpackItems={mockBackpackItems}
        onClose={onClose}
        onTakeItem={onTakeItem}
        onStoreItem={onStoreItem}
      />,
    );

    const storeButton = screen.getByText('STORE');
    fireEvent.click(storeButton);
    expect(onStoreItem).toHaveBeenCalledWith(mockBackpackItems[0]);
  });

  it('displays empty states when container or backpack is empty', () => {
    render(
      <ContainerOverlay
        containerEntityId={99}
        containerItems={[]}
        backpackItems={[]}
        onClose={onClose}
      />,
    );

    expect(screen.getByText('CONTAINER IS EMPTY')).toBeDefined();
    expect(screen.getByText('BACKPACK EMPTY')).toBeDefined();
  });

  it('calls onClose when Escape key is pressed', () => {
    render(
      <ContainerOverlay
        containerEntityId={99}
        containerItems={mockContainerItems}
        onClose={onClose}
      />,
    );

    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders TAKE ALL button and calls onTakeAll when clicked or Space pressed', () => {
    const onTakeAll = vi.fn<() => void>();
    render(
      <ContainerOverlay
        containerEntityId={99}
        containerItems={mockContainerItems}
        onClose={onClose}
        onTakeAll={onTakeAll}
      />,
    );

    const takeAllBtn = screen.getByText('TAKE ALL [SPACE]');
    expect(takeAllBtn).toBeDefined();

    fireEvent.click(takeAllBtn);
    expect(onTakeAll).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(window, { key: ' ', code: 'Space' });
    expect(onTakeAll).toHaveBeenCalledTimes(2);
  });
});
