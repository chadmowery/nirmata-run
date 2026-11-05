import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BackpackGrid } from '../BackpackGrid';
import { setActiveGameContext } from '@/game/active-context';
import { World } from '@engine/ecs/world';
import { EventBus } from '@engine/events/event-bus';
import type { GameEvents } from '@/game/events/types';
import {
  RunInventory,
  PortConfig,
  FirmwareSlots,
  AugmentSlots,
  AbilityDef,
  AugmentData,
  Position,
  Item,
} from '@shared/components';
import type { GameContext } from '@/game/types';

describe('BackpackGrid (U7)', () => {
  let eventBus: EventBus<GameEvents>;
  let world: World<GameEvents>;
  let playerId: number;

  beforeEach(() => {
    eventBus = new EventBus<GameEvents>();
    world = new World<GameEvents>(eventBus);
    playerId = world.createEntity();

    world.addComponent(playerId, Position, { x: 5, y: 5 });
    world.addComponent(playerId, PortConfig, {
      maxFirmware: 3,
      maxAugment: 2,
      maxSoftware: 4,
    });
    world.addComponent(playerId, FirmwareSlots, { equipped: [100] });
    world.addComponent(playerId, AugmentSlots, { equipped: [200] });

    // Item 1: Firmware ability in equipment
    const fwEntity = world.createEntity();
    world.addComponent(fwEntity, AbilityDef, {
      name: 'Shock Pulse',
      heatCost: 15,
      range: 4,
      effectType: 'stun',
      damageAmount: 0,
      dashDistance: 0,
      visionRadius: 0,
      heatPerTurn: 0,
      isToggle: false,
      isActive: false,
      isLegacy: false,
    });

    // Item 2: Augment in equipment
    const agEntity = world.createEntity();
    world.addComponent(agEntity, AugmentData, {
      name: 'Neural Booster',
      trigger: { type: 'ON_KILL' },
      payloads: [],
      maxTriggersPerTurn: 1,
      cooldownTurns: 0,
      isLegacy: false,
    });

    world.addComponent(playerId, RunInventory, {
      maxSlots: 30,
      software: [],
      equipment: [
        {
          entityId: fwEntity,
          templateId: 'ability-shock',
          rarityTier: 'common',
          pickedUpAtFloor: 1,
          pickedUpAtTimestamp: Date.now(),
        },
        {
          entityId: agEntity,
          templateId: 'augment-neural',
          rarityTier: 'rare',
          pickedUpAtFloor: 1,
          pickedUpAtTimestamp: Date.now(),
        },
      ],
    });

    const mockCtx: Partial<GameContext> = {
      world,
      playerId,
      eventBus,
      submitAction: vi.fn(),
    };

    setActiveGameContext(mockCtx as GameContext);
  });

  afterEach(() => {
    setActiveGameContext(null);
    vi.restoreAllMocks();
  });

  it('renders all 30 slots when capacity is 30 and displays correct count in header', () => {
    const { container } = render(<BackpackGrid />);

    expect(screen.getByText(/Backpack \(2 \/ 30\)/i)).toBeDefined();

    // Verify grid has 30 slots rendered
    const slots = container.querySelectorAll('.btn-lever, [class*="slot"]');
    // Filter to slot elements
    const slotElements = Array.from(slots).filter((el) => el.className.includes('slot'));
    expect(slotElements.length).toBe(30);
  });

  it('shows overwrite and burn buttons for firmware according to shell port configuration', () => {
    render(<BackpackGrid />);

    // Click Shock Pulse firmware slot
    const fwItem = screen.getByText('Shock Pulse');
    fireEvent.click(fwItem);

    // Slot 1 is already equipped -> OVERWRITE FIRMWARE (SLOT 1)
    expect(screen.getByText('⚡ OVERWRITE FIRMWARE (SLOT 1)')).toBeDefined();

    // Slot 2 and 3 are empty -> BURN FIRMWARE (SLOT 2), BURN FIRMWARE (SLOT 3)
    expect(screen.getByText('⚡ BURN FIRMWARE (SLOT 2)')).toBeDefined();
    expect(screen.getByText('⚡ BURN FIRMWARE (SLOT 3)')).toBeDefined();

    // Should NOT have Slot 4 because maxFirmware is 3
    expect(screen.queryByText(/SLOT 4/)).toBeNull();
  });

  it('shows overwrite and append buttons with explicit slot indices for augments', () => {
    render(<BackpackGrid />);

    // Click Neural Booster augment slot
    const agItem = screen.getByText('Neural Booster');
    fireEvent.click(agItem);

    // Slot 1 is already equipped -> OVERWRITE AUGMENT (SLOT 1)
    expect(screen.getByText('🧬 OVERWRITE AUGMENT (SLOT 1)')).toBeDefined();

    // Slot 2 is available -> BURN AUGMENT INTO CHASSIS (SLOT 2)
    expect(screen.getByText('🧬 BURN AUGMENT INTO CHASSIS (SLOT 2)')).toBeDefined();
  });
});
