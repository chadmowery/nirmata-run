import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { GroundTransferModal } from '../GroundTransferModal';
import { gameStore } from '@/game/ui/store';
import { setActiveGameContext } from '@/game/active-context';
import { World } from '@engine/ecs/world';
import { EventBus } from '@engine/events/event-bus';
import type { GameEvents } from '@/game/events/types';
import type { ActionIntent } from '@shared/types';
import {
  RunInventory,
  Item,
  EquipmentDef,
  Position,
} from '@shared/components';
import type { GameContext } from '@/game/types';

describe('GroundTransferModal (U6)', () => {
  let onClose: () => void;
  let submitActionMock: (intent: ActionIntent) => Promise<void>;

  beforeEach(() => {
    onClose = vi.fn();
    submitActionMock = vi.fn().mockResolvedValue(undefined);

    const bus = new EventBus<GameEvents>();
    const world = new World<GameEvents>(bus);
    const playerId = world.createEntity();
    world.addComponent(playerId, Position, { x: 5, y: 5 });

    const healthPotionEntity = world.createEntity();
    world.addComponent(healthPotionEntity, Item, {
      name: 'Field Nanite Repair',
      description: 'Heals 5 HP',
      type: 'consumable',
    });

    world.addComponent(playerId, RunInventory, {
      maxSlots: 2,
      software: [],
      equipment: [
        {
          entityId: healthPotionEntity,
          templateId: 'health-potion',
          rarityTier: 'common',
          pickedUpAtFloor: 1,
          pickedUpAtTimestamp: Date.now(),
          quantity: 2,
          isConsumable: true,
        },
        {
          entityId: world.createEntity(),
          templateId: 'rifle-v1',
          rarityTier: 'common',
          pickedUpAtFloor: 1,
          pickedUpAtTimestamp: Date.now(),
          quantity: 1,
          isConsumable: false,
        },
      ],
    });

    const mockCtx: Partial<GameContext> = {
      world,
      playerId,
      submitAction: submitActionMock,
      grid: {
        getItemsAt: () => [],
      } as any,
    };

    setActiveGameContext(mockCtx as GameContext);
  });

  afterEach(() => {
    setActiveGameContext(null);
    vi.restoreAllMocks();
  });

  it('renders correctly and displays consumable name without hardcoding "Nanite Canister"', () => {
    gameStore.getState().updateNearbyGroundItems([
      {
        itemId: 301,
        templateId: 'health-potion',
        name: 'Field Nanite Repair',
        rarityTier: 'common',
        type: 'consumable',
        x: 5,
        y: 5,
        isPlayerTile: true,
        directionLabel: 'CURRENT TILE',
        isConsumable: true,
      },
    ]);

    render(<GroundTransferModal onClose={onClose} />);

    // Check dialog role and title
    expect(screen.getByRole('dialog')).toBeDefined();
    expect(screen.getByText('TACTICAL GROUND RECOVERY & BACKPACK TRANSFER')).toBeDefined();

    // Verify item names in ground and backpack
    const names = screen.getAllByText(/Field Nanite Repair/i);
    expect(names.length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText('Nanite Canister')).toBeNull();
  });

  it('enables TAKE and TAKE ALL when backpack is full if consumable can stack onto an existing stack', async () => {
    // Backpack is full (2/2 slots) with 1 stackable consumable (qty 2 < 10)
    gameStore.getState().updateNearbyGroundItems([
      {
        itemId: 301,
        templateId: 'health-potion',
        name: 'Field Nanite Repair',
        rarityTier: 'common',
        type: 'consumable',
        x: 5,
        y: 5,
        isPlayerTile: true,
        directionLabel: 'CURRENT TILE',
        isConsumable: true,
      },
    ]);

    render(<GroundTransferModal onClose={onClose} />);

    // Backpack shows 2 / 2 SLOTS
    expect(screen.getByText('2 / 2 SLOTS')).toBeDefined();

    // TAKE and TAKE ALL should be enabled because health-potion stacks!
    const takeAllBtn = screen.getByText('TAKE ALL');
    expect(takeAllBtn).toBeDefined();

    const takeBtns = screen.getAllByText('TAKE');
    expect(takeBtns[0].getAttribute('disabled')).toBeNull();

    await act(async () => {
      fireEvent.click(takeBtns[0]);
    });
    expect(submitActionMock).toHaveBeenCalledWith({
      type: 'PICKUP',
      itemId: 301,
      targetX: 5,
      targetY: 5,
    });
  });

  it('disables TAKE when backpack is full and ground item cannot stack', () => {
    gameStore.getState().updateNearbyGroundItems([
      {
        itemId: 302,
        templateId: 'shield-v1',
        name: 'Ablative Shield',
        rarityTier: 'rare',
        type: 'armor',
        x: 5,
        y: 6,
        isPlayerTile: false,
        directionLabel: 'ADJACENT (S)',
        isConsumable: false,
      },
    ]);

    render(<GroundTransferModal onClose={onClose} />);

    // TAKE ALL should NOT be displayed when no ground item can be taken
    expect(screen.queryByText('TAKE ALL')).toBeNull();

    // TAKE should be disabled
    const takeBtn = screen.getByText('TAKE').closest('button');
    expect(takeBtn?.hasAttribute('disabled')).toBe(true);
  });

  it('closes on Escape key press', () => {
    render(<GroundTransferModal onClose={onClose} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});
