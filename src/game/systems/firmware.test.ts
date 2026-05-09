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
  Heat
} from '@shared/components';
import { DamageIntent } from '@shared/components/intents';
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
    firmwareSystem = createFirmwareSystem(world, grid, eventBus);

    heatSystem.init();
    movementSystem.init();
    firmwareSystem.init();
  });

  it('activateAbility returns false when no firmware equipped at slot', () => {
    const playerId = world.createEntity();
    world.addComponent(playerId, FirmwareSlots, { equipped: [] });
    world.addComponent(playerId, Position, { x: 5, y: 5 });

    const result = firmwareSystem.activateAbility(playerId, 0, 5, 5);
    eventBus.flush();
    expect(result).toBe(false);
  });

  it('activateAbility adds heatCost to players Heat', () => {
    const playerId = world.createEntity();
    const firmwareId = world.createEntity();

    world.addComponent(firmwareId, AbilityDef, AbilityDef.schema.parse({
      name: 'Test Ability',
      heatCost: 10,
      range: 5,
      effectType: 'ranged_attack',
      damageAmount: 5,
      cooldown: 0
    }));

    world.addComponent(playerId, FirmwareSlots, { equipped: [firmwareId] });
    world.addComponent(playerId, Position, { x: 5, y: 5 });
    world.addComponent(playerId, Heat, Heat.schema.parse({ current: 0, maxSafe: 100 }));

    firmwareSystem.activateAbility(playerId, 0, 6, 6);
    eventBus.flush();

    const heat = world.getComponent(playerId, Heat);
    expect(heat?.current).toBe(10);
  });

  it('activateAbility with dash effectType moves player to target position', () => {
    const playerId = world.createEntity();
    const firmwareId = world.createEntity();

    world.addComponent(firmwareId, AbilityDef, AbilityDef.schema.parse({
      name: 'Dash',
      heatCost: 5,
      dashDistance: 3,
      range: 0,
      effectType: 'dash',
      cooldown: 0
    }));

    world.addComponent(playerId, FirmwareSlots, { equipped: [firmwareId] });
    world.addComponent(playerId, Position, { x: 5, y: 5 });
    world.addComponent(playerId, Heat, Heat.schema.parse({ current: 0, maxSafe: 100 }));
    grid.addEntity(playerId, 5, 5);

    const result = firmwareSystem.activateAbility(playerId, 0, 7, 6); // Distance 3
    eventBus.flush();
    expect(result).toBe(true);

    const pos = world.getComponent(playerId, Position);
    expect(pos?.x).toBe(7);
    expect(pos?.y).toBe(6);
    expect(grid.getEntitiesAt(7, 6)).toContain(playerId);
    expect(grid.getEntitiesAt(5, 5)).not.toContain(playerId);
  });

  it('activateAbility with ranged_attack effectType adds DamageIntent to attacker', () => {
    const playerId = world.createEntity();
    const enemyId = world.createEntity();
    const firmwareId = world.createEntity();

    world.addComponent(firmwareId, AbilityDef, AbilityDef.schema.parse({
      name: 'Neural Spike',
      heatCost: 15,
      range: 5,
      effectType: 'ranged_attack',
      damageAmount: 10,
      cooldown: 0
    }));

    world.addComponent(playerId, FirmwareSlots, { equipped: [firmwareId] });
    world.addComponent(playerId, Position, { x: 2, y: 2 });
    world.addComponent(playerId, Heat, Heat.schema.parse({ current: 0, maxSafe: 100 }));

    world.addComponent(enemyId, Position, { x: 4, y: 4 });
    world.addComponent(enemyId, Health, Health.schema.parse({ current: 20, max: 20, isAlive: true }));
    world.addComponent(enemyId, Defense, { armor: 2 });
    grid.addEntity(enemyId, 4, 4);

    const result = firmwareSystem.activateAbility(playerId, 0, 4, 4);
    eventBus.flush();
    expect(result).toBe(true);

    // Per the Death Protocol, the Firmware system only adds the intent
    const intent = world.getComponent(playerId, DamageIntent);
    expect(intent).toBeDefined();
    expect(intent?.targetId).toBe(enemyId);
    expect(intent?.amount).toBe(10);
  });

  it('activateAbility with toggle_vision toggles isActive on ability entity', () => {
    const playerId = world.createEntity();
    const firmwareId = world.createEntity();

    world.addComponent(firmwareId, AbilityDef, AbilityDef.schema.parse({
      name: 'Extended Sight',
      heatCost: 0,
      range: 0,
      effectType: 'toggle_vision',
      isToggle: true,
      isActive: false,
      cooldown: 0
    }));

    world.addComponent(playerId, FirmwareSlots, { equipped: [firmwareId] });
    world.addComponent(playerId, Position, { x: 5, y: 5 });
    world.addComponent(playerId, Heat, Heat.schema.parse({ current: 0, maxSafe: 100 }));

    firmwareSystem.activateAbility(playerId, 0, 5, 5);
    eventBus.flush();

    const ability = world.getComponent(firmwareId, AbilityDef);
    expect(ability?.isActive).toBe(true);

    firmwareSystem.activateAbility(playerId, 0, 5, 5);
    eventBus.flush();
    const ability2 = world.getComponent(firmwareId, AbilityDef);
    expect(ability2?.isActive).toBe(false);
  });

  it('activateAbility with isLegacy=true doubles the Heat cost', () => {
    const playerId = world.createEntity();
    const firmwareId = world.createEntity();

    world.addComponent(firmwareId, AbilityDef, AbilityDef.schema.parse({
      name: 'Legacy Spike',
      heatCost: 10,
      range: 5,
      effectType: 'ranged_attack',
      damageAmount: 5,
      isLegacy: true,
      cooldown: 0
    }));

    world.addComponent(playerId, FirmwareSlots, { equipped: [firmwareId] });
    world.addComponent(playerId, Position, { x: 5, y: 5 });
    world.addComponent(playerId, Heat, Heat.schema.parse({ current: 0, maxSafe: 100 }));

    firmwareSystem.activateAbility(playerId, 0, 6, 6);
    eventBus.flush();

    const heat = world.getComponent(playerId, Heat);
    expect(heat?.current).toBe(20); // 10 * 2
  });

  it('activateAbility emits FIRMWARE_ACTIVATED event', () => {
    const playerId = world.createEntity();
    const firmwareId = world.createEntity();

    world.addComponent(firmwareId, AbilityDef, AbilityDef.schema.parse({
      name: 'Test Ability',
      heatCost: 10,
      range: 5,
      effectType: 'ranged_attack',
      damageAmount: 5,
      cooldown: 0
    }));

    world.addComponent(playerId, FirmwareSlots, { equipped: [firmwareId] });
    world.addComponent(playerId, Position, { x: 5, y: 5 });
    world.addComponent(playerId, Heat, Heat.schema.parse({ current: 0, maxSafe: 100 }));

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

    world.addComponent(firmwareId, AbilityDef, AbilityDef.schema.parse({
      name: 'Short Range Spike',
      heatCost: 10,
      range: 2,
      effectType: 'ranged_attack',
      damageAmount: 5,
      cooldown: 0
    }));

    world.addComponent(playerId, FirmwareSlots, { equipped: [firmwareId] });
    world.addComponent(playerId, Position, { x: 5, y: 5 });
    world.addComponent(playerId, Heat, Heat.schema.parse({ current: 0, maxSafe: 100 }));

    const result = firmwareSystem.activateAbility(playerId, 0, 8, 8); // Distance 6
    eventBus.flush();
    expect(result).toBe(false);
  });
});
