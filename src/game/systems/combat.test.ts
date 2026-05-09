import { describe, it, expect, vi, beforeEach } from 'vitest';
import { World } from '@engine/ecs/world';
import { Grid } from '@engine/grid/grid';
import { EventBus } from '@engine/events/event-bus';
import { EntityFactory } from '@engine/entity/factory';
import { createCombatSystem } from './combat';
import { Attack, Defense, Health, Position, Heat, AttackIntent, Dying, DamageIntent } from '@shared/components';
import { Phase } from '@engine/ecs/types';
import { GameplayEvents } from '@shared/events/types';
import { ComponentRegistry } from '@engine/entity/types';

describe('CombatSystem', () => {
  let world: World<GameplayEvents>;
  let grid: Grid;
  let eventBus: EventBus<GameplayEvents>;
  let entityFactory: EntityFactory;
  let componentRegistry: ComponentRegistry;
  let combatSystem: ReturnType<typeof createCombatSystem>;

  beforeEach(() => {
    eventBus = new EventBus<GameplayEvents>();
    world = new World<GameplayEvents>(eventBus);
    grid = new Grid(10, 10);
    // Mock registry/factory for loot
    const mockRegistry = { get: vi.fn() } as any;
    entityFactory = new EntityFactory(mockRegistry);
    vi.spyOn(entityFactory, 'create').mockReturnValue(999 as any);

    componentRegistry = {} as any;
    combatSystem = createCombatSystem(world, grid, eventBus, entityFactory, componentRegistry);
    combatSystem.init();
  });

  it('should resolve damage based on AttackIntent during REACTION phase', () => {
    const attacker = world.createEntity();
    world.addComponent(attacker, Attack, { power: 5 });

    const defender = world.createEntity();
    world.addComponent(defender, Health, { current: 10, max: 10, isAlive: true });
    world.addComponent(defender, Defense, { armor: 2 });

    const damageDealtSpy = vi.fn();
    eventBus.on('DAMAGE_DEALT', damageDealtSpy);

    world.addComponent(attacker, AttackIntent, { targetId: defender });
    world.executeSystems(Phase.REACTION);
    eventBus.flush();

    const health = world.getComponent(defender, Health);
    expect(health?.current).toBe(7); // 10 - (5 - 2)
    expect(damageDealtSpy).toHaveBeenCalledWith(expect.objectContaining({
      attackerId: attacker,
      defenderId: defender,
      amount: 3,
    }));
    expect(world.hasComponent(attacker, AttackIntent)).toBe(false); // Should be cleared
  });

  it('should resolve damage based on DamageIntent during REACTION phase', () => {
    const requester = world.createEntity();

    const defender = world.createEntity();
    world.addComponent(defender, Health, { current: 10, max: 10, isAlive: true });
    world.addComponent(defender, Defense, { armor: 2 });

    const damageDealtSpy = vi.fn();
    eventBus.on('DAMAGE_DEALT', damageDealtSpy);

    // DamageIntent is direct damage (e.g. from Firmware)
    world.addComponent(requester, DamageIntent, { targetId: defender, amount: 5 });
    world.executeSystems(Phase.REACTION);
    eventBus.flush();

    const health = world.getComponent(defender, Health);
    expect(health?.current).toBe(7); // 10 - (5 - 2)
    expect(damageDealtSpy).toHaveBeenCalledWith(expect.objectContaining({
      attackerId: requester,
      defenderId: defender,
      amount: 3,
    }));
    expect(world.hasComponent(requester, DamageIntent)).toBe(false); // Should be cleared
  });

  it('should deal at least 1 damage even if defense is high', () => {
    const attacker = world.createEntity();
    world.addComponent(attacker, Attack, { power: 1 });

    const defender = world.createEntity();
    world.addComponent(defender, Health, { current: 10, max: 10, isAlive: true });
    world.addComponent(defender, Defense, { armor: 10 });

    world.addComponent(attacker, AttackIntent, { targetId: defender });
    world.executeSystems(Phase.REACTION);

    const health = world.getComponent(defender, Health);
    expect(health?.current).toBe(9);
  });

  it('should ignore armor if defender is venting', () => {
    const attacker = world.createEntity();
    world.addComponent(attacker, Attack, { power: 5 });

    const defender = world.createEntity();
    world.addComponent(defender, Health, { current: 10, max: 10, isAlive: true });
    world.addComponent(defender, Defense, { armor: 10 });
    world.addComponent(defender, Heat, { current: 50, maxSafe: 100, isVenting: true, baseDissipation: 1, ventPercentage: 0.5 });

    world.addComponent(attacker, AttackIntent, { targetId: defender });
    world.executeSystems(Phase.REACTION);

    const health = world.getComponent(defender, Health);
    expect(health?.current).toBe(5); // 10 - 5 (armor ignored)
  });

  it('should handle entity death by adding Dying component', () => {
    const attacker = world.createEntity();
    world.addComponent(attacker, Attack, { power: 20 });

    const defender = world.createEntity();
    world.addComponent(defender, Position, { x: 5, y: 5 });
    world.addComponent(defender, Health, { current: 10, max: 10, isAlive: true });
    grid.addEntity(defender, 5, 5);

    const diedSpy = vi.fn();
    eventBus.on('ENTITY_DIED', diedSpy);

    world.addComponent(attacker, AttackIntent, { targetId: defender });
    world.executeSystems(Phase.REACTION);
    eventBus.flush();

    // Per the Death Protocol, CombatSystem only adds the tag.
    // Grid removal is deferred to Gravedigger in Phase.CLEANUP.
    expect(grid.getEntitiesAt(5, 5).has(defender)).toBe(true);
    expect(world.hasComponent(defender, Dying)).toBe(true);
    expect(world.getComponent(defender, Dying)?.killerId).toBe(attacker);

    expect(diedSpy).toHaveBeenCalledWith(expect.objectContaining({
      entityId: defender,
      killerId: attacker,
    }));
  });
});
