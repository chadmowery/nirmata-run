import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '@engine/ecs/world';
import { Grid } from '@engine/grid/grid';
import { EventBus } from '@engine/events/event-bus';
import { Phase } from '@engine/ecs/types';
import {
  Attack,
  Health,
  Position,
  Actor,
  Hostile,
  InteractiveSurface,
  StatusEffects,
  DeadZone,
  BlocksMovement,
} from '@shared/components';
import { AttackIntent } from '@shared/components/intents';
import { GameplayEvents } from '@shared/events/types';
import { createCombatSystem } from '../../src/game/systems/combat';
import { createDeadZoneSystem } from '../../src/game/systems/dead-zone';

describe('M8: Cryo Hazard Spill & Data-Driven Radius', () => {
  let world: World<GameplayEvents>;
  let grid: Grid;
  let eventBus: EventBus<GameplayEvents>;

  beforeEach(() => {
    eventBus = new EventBus<GameplayEvents>();
    world = new World<GameplayEvents>(eventBus);
    grid = new Grid(20, 20);
  });

  it('spawns persistent DeadZone hazards across 3x3 footprint on Cryo-Vat destruction', () => {
    const combat = createCombatSystem(world, grid, eventBus);
    combat.init();
    const deadZoneSystem = createDeadZoneSystem(world, grid);
    deadZoneSystem.init();

    // Player attacks the vat from (5, 4)
    const player = world.createEntity();
    world.addComponent(player, Position, { x: 5, y: 4 });
    world.addComponent(player, Attack, { power: 20 });
    world.addComponent(player, Actor, { isPlayer: true });
    world.addComponent(player, Health, { current: 100, max: 100, isAlive: true });
    grid.addEntity(player, 5, 4);

    // Cryo-vat at (5, 6)
    const vat = world.createEntity();
    world.addComponent(vat, Position, { x: 5, y: 6 });
    world.addComponent(vat, Health, { current: 10, max: 10, isAlive: true });
    world.addComponent(vat, InteractiveSurface, {
      surfaceId: 'cryo_vat',
      hazardOnDestroy: 'cryo_spill',
      hazardRadius: 1,
    });
    grid.addEntity(vat, 5, 6);

    // Enemy standing in blast at (6, 6)
    const enemy = world.createEntity();
    world.addComponent(enemy, Position, { x: 6, y: 6 });
    world.addComponent(enemy, Health, { current: 50, max: 50, isAlive: true });
    world.addComponent(enemy, Hostile, {});
    grid.addEntity(enemy, 6, 6);

    world.addComponent(player, AttackIntent, { targetId: vat });

    // Execute combat reaction phase
    world.executeSystems(Phase.REACTION);
    eventBus.flush();

    // Enemy took immediate 4 damage (50 - 4 = 46) and gained MOVEMENT_SLOW
    const enemyHealth = world.getComponent(enemy, Health)!;
    expect(enemyHealth.current).toBe(46);
    const status = world.getComponent(enemy, StatusEffects);
    expect(status?.effects.some((e) => e.name === 'MOVEMENT_SLOW')).toBe(true);

    // Assert DeadZone entities were created across the 3x3 footprint (x: 4..6, y: 5..7)
    const deadZoneEntities = world.query(DeadZone, Position);
    expect(deadZoneEntities.length).toBeGreaterThanOrEqual(9);

    // Check dead zone on enemy's tile (6, 6)
    const dzAtEnemy = deadZoneEntities.find((id) => {
      const p = world.getComponent(id, Position)!;
      return p.x === 6 && p.y === 6;
    });
    expect(dzAtEnemy).toBeDefined();
    const dzData = world.getComponent(dzAtEnemy!, DeadZone)!;
    expect(dzData.damagePerTick).toBe(4);
    expect(dzData.remainingTurns).toBe(3);

    // On the next turn's Phase.ACTION, DeadZoneSystem ticks damage
    world.executeSystems(Phase.ACTION);
    // Enemy should take another 4 damage from the DeadZone tick in Phase.REACTION
    world.executeSystems(Phase.REACTION);
    expect(world.getComponent(enemy, Health)!.current).toBe(42);
  });

  it('respects data-driven hazardRadius property on InteractiveSurface', () => {
    const combat = createCombatSystem(world, grid, eventBus);
    combat.init();

    const player = world.createEntity();
    world.addComponent(player, Position, { x: 5, y: 2 });
    world.addComponent(player, Attack, { power: 25 });
    world.addComponent(player, Actor, { isPlayer: true });

    // Super capacitor bank with hazardRadius: 3
    const cap = world.createEntity();
    world.addComponent(cap, Position, { x: 10, y: 10 });
    world.addComponent(cap, Health, { current: 10, max: 10, isAlive: true });
    world.addComponent(cap, InteractiveSurface, {
      surfaceId: 'capacitor_bank',
      hazardOnDestroy: 'emp_arc',
      hazardRadius: 3,
    });

    // Enemy at Manhattan distance 3 from cap: (10, 13)
    const enemy = world.createEntity();
    world.addComponent(enemy, Position, { x: 10, y: 13 });
    world.addComponent(enemy, Health, { current: 50, max: 50, isAlive: true });
    world.addComponent(enemy, Hostile, {});

    world.addComponent(player, AttackIntent, { targetId: cap });
    world.executeSystems(Phase.REACTION);
    eventBus.flush();

    // Enemy at distance 3 was hit because hazardRadius: 3 (10 EMP damage)
    const enemyHealth = world.getComponent(enemy, Health)!;
    expect(enemyHealth.current).toBe(40);
  });

  it('exempts player from self-harm when friendlyFire is disabled', () => {
    const combat = createCombatSystem(world, grid, eventBus);
    combat.init();

    // Player in melee range (5, 5) attacks adjacent cryo-vat (5, 6)
    const player = world.createEntity();
    world.addComponent(player, Position, { x: 5, y: 5 });
    world.addComponent(player, Attack, { power: 20 });
    world.addComponent(player, Actor, { isPlayer: true });
    world.addComponent(player, Health, { current: 100, max: 100, isAlive: true });

    const vat = world.createEntity();
    world.addComponent(vat, Position, { x: 5, y: 6 });
    world.addComponent(vat, Health, { current: 10, max: 10, isAlive: true });
    world.addComponent(vat, InteractiveSurface, {
      surfaceId: 'cryo_vat_safe',
      hazardOnDestroy: 'cryo_spill',
      hazardRadius: 1,
      friendlyFire: false, // Player-safe
    });

    world.addComponent(player, AttackIntent, { targetId: vat });
    world.executeSystems(Phase.REACTION);
    eventBus.flush();

    // Player took no damage because friendlyFire was disabled
    const playerHealth = world.getComponent(player, Health)!;
    expect(playerHealth.current).toBe(100);
    const status = world.getComponent(player, StatusEffects);
    expect(status?.effects.some((e) => e.name === 'MOVEMENT_SLOW') ?? false).toBe(false);
  });
});
