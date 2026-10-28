import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '@engine/ecs/world';
import { Grid } from '@engine/grid/grid';
import { EventBus } from '@engine/events/event-bus';
import { GameplayEvents } from '@shared/events/types';
import { DeadZone, Position, Health, Dying, DamageIntent, Actor } from '@shared/components';
import { createDeadZoneSystem } from '../dead-zone';
import { Phase } from '@engine/ecs/types';

describe('DeadZoneSystem Unit Tests', () => {
  let world: World<GameplayEvents>;
  let grid: Grid;
  let eventBus: EventBus<GameplayEvents>;
  let deadZoneSystem: ReturnType<typeof createDeadZoneSystem>;

  beforeEach(() => {
    eventBus = new EventBus<GameplayEvents>();
    world = new World<GameplayEvents>(eventBus);
    grid = new Grid(10, 10);
    deadZoneSystem = createDeadZoneSystem(world, grid);
    deadZoneSystem.init();
  });

  it('creates dead zone entity with position and duration', () => {
    const dzId = deadZoneSystem.createDeadZone(3, 4, 3, 5, 99);

    expect(world.entityExists(dzId)).toBe(true);
    const pos = world.getComponent(dzId, Position);
    expect(pos).toEqual({ x: 3, y: 4 });

    const dz = world.getComponent(dzId, DeadZone);
    expect(dz).toEqual({
      remainingTurns: 3,
      damagePerTick: 5,
      creatorId: 99,
    });
    expect(grid.getEntitiesAt(3, 4).has(dzId)).toBe(true);
  });

  it('deals DamageIntent to entities standing on hazard tile', () => {
    const dzId = deadZoneSystem.createDeadZone(2, 2, 2, 4);

    const victim = world.createEntity();
    world.addComponent(victim, Actor, { isPlayer: false });
    world.addComponent(victim, Position, { x: 2, y: 2 });
    world.addComponent(victim, Health, { current: 10, max: 10, isAlive: true });
    grid.addEntity(victim, 2, 2);

    world.executeSystems(Phase.ACTION);

    // Victim should receive DamageIntent from dead zone
    const damageIntent = world.getComponent(dzId, DamageIntent);
    expect(damageIntent).toBeDefined();
    expect(damageIntent?.targetId).toBe(victim);
    expect(damageIntent?.amount).toBe(4);

    // Remaining turns should decrement
    const dz = world.getComponent(dzId, DeadZone);
    expect(dz?.remainingTurns).toBe(1);
    expect(world.hasComponent(dzId, Dying)).toBe(false);
  });

  it('marks dead zone as Dying when duration expires', () => {
    const dzId = deadZoneSystem.createDeadZone(5, 5, 1, 3);

    world.executeSystems(Phase.ACTION);

    const dz = world.getComponent(dzId, DeadZone);
    expect(dz?.remainingTurns).toBe(0);
    expect(world.hasComponent(dzId, Dying)).toBe(true);
    expect(world.getComponent(dzId, Dying)?.reason).toBe('expiration');
  });
});
