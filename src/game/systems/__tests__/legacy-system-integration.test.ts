import { describe, it, expect, beforeEach, vi } from 'vitest';
import { World } from '@engine/ecs/world';
import { EventBus } from '@engine/events/event-bus';
import { Grid } from '@engine/grid/grid';
import { createFirmwareSystem } from '../firmware';
import { createAugmentSystem } from '../augment';
import { AbilityDef, Health, Heat, AugmentSlots, AugmentData, AugmentState, Position } from '@shared/components';
import { GameEvents } from '../../events/types';

describe('Legacy System Integration', () => {
  let world: World<GameEvents>;
  let eventBus: EventBus<GameEvents>;
  let grid: Grid;

  beforeEach(() => {
    eventBus = new EventBus<GameEvents>();
    world = new World<GameEvents>(eventBus);
    grid = new Grid(10, 10);
  });

  it('doubles heat cost for legacy firmware', () => {
    const heatSystem = { addHeat: vi.fn() } as any;
    const fwSystem = createFirmwareSystem(world, grid, eventBus, {} as any, heatSystem);
    
    const playerId = world.createEntity();
    world.addComponent(playerId, Position, { x: 0, y: 0 });
    
    const abilityId = world.createEntity();
    world.addComponent(abilityId, AbilityDef, {
      name: 'Test',
      heatCost: 10,
      isLegacy: true,
      effectType: 'dash',
      dashDistance: 1,
      damageAmount: 0,
      range: 0,
      isActive: false
    });

    world.addComponent(playerId, { key: 'firmwareSlots', schema: {} as any }, { equipped: [abilityId] } as any);

    fwSystem.activateAbility(playerId, 0, 1, 0);
    
    expect(heatSystem.addHeat).toHaveBeenCalledWith(playerId, 20); // 10 * 2
  });

  it('halves payload magnitude for legacy augments', () => {
    const statusEffectSystem = { applyEffect: vi.fn() } as any;
    const augmentSystem = createAugmentSystem(world, eventBus, statusEffectSystem, {} as any);
    
    const playerId = world.createEntity();
    const augmentId = world.createEntity();
    
    world.addComponent(augmentId, AugmentData, {
      name: 'Shield Aug',
      isLegacy: true,
      trigger: { type: 'ON_ACTIVATION' },
      payloads: [{ type: 'SHIELD', magnitude: 10 }],
      maxTriggersPerTurn: 1,
      cooldownTurns: 0
    });

    world.addComponent(playerId, AugmentSlots, { equipped: [augmentId] });
    world.addComponent(playerId, AugmentState, { activationsThisTurn: {}, cooldownsRemaining: {} });
    world.addComponent(playerId, Heat, { current: 0, maxSafe: 100, baseDissipation: 5, ventPercentage: 0.5, isVenting: false });
    world.addComponent(playerId, Health, { current: 100, max: 100 });

    augmentSystem.processTriggersForEntity(playerId, {
      firmwareActivated: true,
      damageDealt: 0,
      killCount: 0,
      heatAboveMax: false,
      currentHeat: 0,
      hpPercent: 100
    });

    expect(statusEffectSystem.applyEffect).toHaveBeenCalledWith(playerId, expect.objectContaining({
      name: 'SHIELD',
      magnitude: 5 // 10 * 0.5
    }));
  });
});
