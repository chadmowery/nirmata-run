import { describe, it, expect, beforeEach, vi } from 'vitest';
import { World } from '@engine/ecs/world';
import { Grid } from '@engine/grid/grid';
import { EventBus } from '@engine/events/event-bus';
import { GameplayEvents } from '@shared/events/types';
import {
  Actor,
  Position,
  Prop,
  RunInventory,
  RunCurrency,
  InteractPropIntent,
} from '@shared/components';
import { getCurrencyAmount, addCurrency } from '@shared/utils/inventory-util';
import { createPropInteractionSystem } from '../../src/game/systems/prop-interaction';

describe('M3: Dead-Drop Uplink Flux & Inventory Validation', () => {
  let world: World<GameplayEvents>;
  let grid: Grid;
  let eventBus: EventBus<GameplayEvents>;
  let playerId: number;
  let uplinkPropId: number;

  beforeEach(() => {
    eventBus = new EventBus<GameplayEvents>();
    world = new World<GameplayEvents>(eventBus);
    grid = new Grid(20, 20);

    playerId = world.createEntity();
    world.addComponent(playerId, Actor, { isPlayer: true });
    world.addComponent(playerId, Position, { x: 5, y: 5 });
    world.addComponent(playerId, RunCurrency, { stacks: [] });
    world.addComponent(playerId, RunInventory, {
      maxSlots: 5,
      software: [],
      equipment: [],
    });

    // Give player 50 flux
    addCurrency(world, playerId, 'flux', 50);

    uplinkPropId = world.createEntity();
    world.addComponent(uplinkPropId, Prop, {
      propId: 'prop_uplink_1',
      faction: 'traxus',
      propClass: 'dead_drop_uplink',
      isSearched: false,
      deadDropFluxCost: 25,
    });
    world.addComponent(uplinkPropId, Position, { x: 5, y: 6 });
  });

  it('does NOT charge Flux and does NOT mark prop searched when item selection is invalid', () => {
    const propSystem = createPropInteractionSystem(world, grid, eventBus);
    propSystem.init();

    const deadDropSpy = vi.fn();
    eventBus.on('DEAD_DROP_TRANSMITTED', deadDropSpy);

    // Intent targets nonexistent item ID 9999
    world.addComponent(playerId, InteractPropIntent, {
      targetPropId: uplinkPropId,
      deadDropSelectionId: 9999,
    });

    propSystem.update(world);
    eventBus.flush();

    // Flux must still be 50
    expect(getCurrencyAmount(world, playerId, 'flux')).toBe(50);
    expect(deadDropSpy).not.toHaveBeenCalled();

    const prop = world.getComponent(uplinkPropId, Prop)!;
    expect(prop.isSearched).toBe(false);
  });

  it('charges Flux, removes item from inventory, and emits event when item exists', () => {
    // Add item to RunInventory
    world.patchComponent(playerId, RunInventory, {
      software: [
        {
          entityId: 101,
          templateId: 'vampire-exe',
          rarityTier: 'v2.x',
          pickedUpAtFloor: 6,
          pickedUpAtTimestamp: Date.now(),
        },
      ],
      equipment: [],
    });

    const propSystem = createPropInteractionSystem(world, grid, eventBus);
    propSystem.init();

    const deadDropSpy = vi.fn();
    eventBus.on('DEAD_DROP_TRANSMITTED', deadDropSpy);

    world.addComponent(playerId, InteractPropIntent, {
      targetPropId: uplinkPropId,
      deadDropSelectionId: 101,
    });

    propSystem.update(world);
    eventBus.flush();

    // Flux deducted by 25: 50 -> 25
    expect(getCurrencyAmount(world, playerId, 'flux')).toBe(25);
    expect(deadDropSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        entityId: playerId,
        itemEntityId: 101,
      }),
    );

    // Software removed from RunInventory
    const inv = world.getComponent(playerId, RunInventory)!;
    expect(inv.software.length).toBe(0);

    const prop = world.getComponent(uplinkPropId, Prop)!;
    expect(prop.isSearched).toBe(true);
  });
});
