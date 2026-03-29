import { describe, it, expect, beforeEach, vi } from 'vitest';
import { World } from '@engine/ecs/world';
import { Grid } from '@engine/grid/grid';
import { EventBus } from '@engine/events/event-bus';
import { 
  AbilityDef, 
  FirmwareSlots, 
  Position, 
  Health, 
  Defense, 
  Heat,
  Actor
} from '@shared/components';
import { GameplayEvents } from '@shared/events/types';
import { createFirmwareSystem } from './firmware';
import { createHeatSystem } from './heat';
import { createMovementSystem } from './movement';

describe('FirmwareSystem', () => {
  let world: World<GameplayEvents>;
  let grid: Grid;
  let eventBus: EventBus<GameplayEvents>;
  let heatSystem: ReturnType<typeof createHeatSystem>;
  let movementSystem: ReturnType<typeof createMovementSystem>;
  let firmwareSystem: ReturnType<typeof createFirmwareSystem>;

  beforeEach(() => {
    eventBus = new EventBus();
    world = new World(eventBus);
    grid = new Grid(10, 10);
    heatSystem = createHeatSystem(world, eventBus);
    movementSystem = createMovementSystem(world, grid, eventBus);
    firmwareSystem = createFirmwareSystem(world, grid, eventBus, movementSystem, heatSystem);
  });

  it('activateAbility returns false when no firmware equipped at slot', () => {
    const playerId = world.createEntity();
    world.addComponent(playerId, FirmwareSlots, { equipped: [] });
    world.addComponent(playerId, Position, { x: 5, y: 5 });

    const result = firmwareSystem.activateAbility(playerId, 0, 5, 5);
    expect(result).toBe(false);
  });

  it('activateAbility adds heatCost to players Heat', () => {
    const playerId = world.createEntity();
    const firmwareId = world.createEntity();
    
    world.addComponent(firmwareId, AbilityDef, {
      name: 'Test Ability',
      heatCost: 10,
      range: 5,
      effectType: 'ranged_attack',
      damageAmount: 5
    });

    world.addComponent(playerId, FirmwareSlots, { equipped: [firmwareId] });
    world.addComponent(playerId, Position, { x: 5, y: 5 });
    world.addComponent(playerId, Heat, { current: 0, maxSafe: 100 });

    firmwareSystem.activateAbility(playerId, 0, 6, 6);
    
    const heat = world.getComponent(playerId, Heat);
    expect(heat?.current).toBe(10);
  });

  it('activateAbility with dash effectType moves player to target position', () => {
    const playerId = world.createEntity();
    const firmwareId = world.createEntity();
    
    world.addComponent(firmwareId, AbilityDef, {
      name: 'Dash',
      heatCost: 5,
      dashDistance: 3,
      effectType: 'dash'
    });

    world.addComponent(playerId, FirmwareSlots, { equipped: [firmwareId] });
    world.addComponent(playerId, Position, { x: 5, y: 5 });
    world.addComponent(playerId, Heat, { current: 0, maxSafe: 100 });
    grid.addEntity(playerId, 5, 5);

    const result = firmwareSystem.activateAbility(playerId, 0, 7, 6); // Distance 3
    expect(result).toBe(true);

    const pos = world.getComponent(playerId, Position);
    expect(pos?.x).toBe(7);
    expect(pos?.y).toBe(6);
    expect(grid.getEntitiesAt(7, 6)).toContain(playerId);
    expect(grid.getEntitiesAt(5, 5)).not.toContain(playerId);
  });

  it('activateAbility with ranged_attack effectType deals damage to target entity', () => {
    const playerId = world.createEntity();
    const enemyId = world.createEntity();
    const firmwareId = world.createEntity();
    
    world.addComponent(firmwareId, AbilityDef, {
      name: 'Neural Spike',
      heatCost: 15,
      range: 5,
      effectType: 'ranged_attack',
      damageAmount: 10
    });

    world.addComponent(playerId, FirmwareSlots, { equipped: [firmwareId] });
    world.addComponent(playerId, Position, { x: 2, y: 2 });
    world.addComponent(playerId, Heat, { current: 0, maxSafe: 100 });

    world.addComponent(enemyId, Position, { x: 4, y: 4 });
    world.addComponent(enemyId, Health, { current: 20, max: 20 });
    world.addComponent(enemyId, Defense, { armor: 2 });
    grid.addEntity(enemyId, 4, 4);

    const result = firmwareSystem.activateAbility(playerId, 0, 4, 4);
    expect(result).toBe(true);

    const enemyHealth = world.getComponent(enemyId, Health);
    expect(enemyHealth?.current).toBe(12); // 20 - (10 - 2) = 12
  });

  it('activateAbility with toggle_vision toggles isActive on ability entity', () => {
    const playerId = world.createEntity();
    const firmwareId = world.createEntity();
    
    world.addComponent(firmwareId, AbilityDef, {
      name: 'Extended Sight',
      heatCost: 0,
      range: 0,
      effectType: 'toggle_vision',
      isToggle: true,
      isActive: false
    });

    world.addComponent(playerId, FirmwareSlots, { equipped: [firmwareId] });
    world.addComponent(playerId, Position, { x: 5, y: 5 });
    world.addComponent(playerId, Heat, { current: 0, maxSafe: 100 });

    firmwareSystem.activateAbility(playerId, 0, 5, 5);
    
    const ability = world.getComponent(firmwareId, AbilityDef);
    expect(ability?.isActive).toBe(true);

    firmwareSystem.activateAbility(playerId, 0, 5, 5);
    expect(ability?.isActive).toBe(false);
  });

  it('activateAbility with isLegacy=true doubles the Heat cost', () => {
    const playerId = world.createEntity();
    const firmwareId = world.createEntity();
    
    world.addComponent(firmwareId, AbilityDef, {
      name: 'Legacy Spike',
      heatCost: 10,
      range: 5,
      effectType: 'ranged_attack',
      damageAmount: 5,
      isLegacy: true
    });

    world.addComponent(playerId, FirmwareSlots, { equipped: [firmwareId] });
    world.addComponent(playerId, Position, { x: 5, y: 5 });
    world.addComponent(playerId, Heat, { current: 0, maxSafe: 100 });

    firmwareSystem.activateAbility(playerId, 0, 6, 6);
    
    const heat = world.getComponent(playerId, Heat);
    expect(heat?.current).toBe(20); // 10 * 2
  });

  it('activateAbility emits FIRMWARE_ACTIVATED event', () => {
    const playerId = world.createEntity();
    const firmwareId = world.createEntity();
    
    world.addComponent(firmwareId, AbilityDef, {
      name: 'Test Ability',
      heatCost: 10,
      range: 5,
      effectType: 'ranged_attack',
      damageAmount: 5
    });

    world.addComponent(playerId, FirmwareSlots, { equipped: [firmwareId] });
    world.addComponent(playerId, Position, { x: 5, y: 5 });
    world.addComponent(playerId, Heat, { current: 0, maxSafe: 100 });

    const spy = vi.fn();
    eventBus.on('FIRMWARE_ACTIVATED' as any, spy);

    firmwareSystem.activateAbility(playerId, 0, 6, 6);
    eventBus.flush();
    
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({
      entityId: playerId,
      slotIndex: 0,
      targetX: 6,
      targetY: 6,
      abilityName: 'Test Ability'
    }));
  });

  it('activateAbility rejects target out of range', () => {
    const playerId = world.createEntity();
    const firmwareId = world.createEntity();
    
    world.addComponent(firmwareId, AbilityDef, {
      name: 'Short Range Spike',
      heatCost: 10,
      range: 2,
      effectType: 'ranged_attack',
      damageAmount: 5
    });

    world.addComponent(playerId, FirmwareSlots, { equipped: [firmwareId] });
    world.addComponent(playerId, Position, { x: 5, y: 5 });
    world.addComponent(playerId, Heat, { current: 0, maxSafe: 100 });

    const result = firmwareSystem.activateAbility(playerId, 0, 8, 8); // Distance 6
    expect(result).toBe(false);
  });
});
