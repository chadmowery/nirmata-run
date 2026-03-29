import { describe, it, expect, vi, beforeEach } from 'vitest';
import { World } from '@engine/ecs/world';
import { Grid } from '@engine/grid/grid';
import { EventBus } from '@engine/events/event-bus';
import { EntityFactory } from '@engine/entity/factory';
import { createCombatSystem } from './combat';
import { Attack, Defense, LootTable, Health, Position } from '@shared/components';
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

  it('should resolve damage based on attack and defense', () => {
    const attacker = world.createEntity();
    world.addComponent(attacker, Attack, { power: 5 });

    const defender = world.createEntity();
    world.addComponent(defender, Health, { current: 10, max: 10 });
    world.addComponent(defender, Defense, { armor: 2 });

    const damageDealtSpy = vi.fn();
    eventBus.on('DAMAGE_DEALT', damageDealtSpy);

    eventBus.emit('BUMP_ATTACK', { attackerId: attacker, defenderId: defender });
    eventBus.flush();

    const health = world.getComponent(defender, Health);
    expect(health?.current).toBe(7); // 10 - (5 - 2)
    expect(damageDealtSpy).toHaveBeenCalledWith({
      attackerId: attacker,
      defenderId: defender,
      amount: 3,
    });
  });

  it('should deal at least 1 damage even if defense is high', () => {
    const attacker = world.createEntity();
    world.addComponent(attacker, Attack, { power: 1 });

    const defender = world.createEntity();
    world.addComponent(defender, Health, { current: 10, max: 10 });
    world.addComponent(defender, Defense, { armor: 10 });

    eventBus.emit('BUMP_ATTACK', { attackerId: attacker, defenderId: defender });
    eventBus.flush();

    const health = world.getComponent(defender, Health);
    expect(health?.current).toBe(9);
  });

  it('should not deal damage if attacker lacks Attack component', () => {
    const attacker = world.createEntity();
    const defender = world.createEntity();
    world.addComponent(defender, Health, { current: 10, max: 10 });

    eventBus.emit('BUMP_ATTACK', { attackerId: attacker, defenderId: defender });
    eventBus.flush();

    const health = world.getComponent(defender, Health);
    expect(health?.current).toBe(10);
  });

  it('should handle entity death', () => {
    const attacker = world.createEntity();
    world.addComponent(attacker, Attack, { power: 20 });

    const defender = world.createEntity();
    world.addComponent(defender, Position, { x: 5, y: 5 });
    world.addComponent(defender, Health, { current: 10, max: 10 });
    grid.addEntity(defender, 5, 5);

    const diedSpy = vi.fn();
    eventBus.on('ENTITY_DIED', diedSpy);

    eventBus.emit('BUMP_ATTACK', { attackerId: attacker, defenderId: defender });
    eventBus.flush();

    expect(grid.getEntitiesAt(5, 5).has(defender)).toBe(false);
    expect(world['entities'].has(defender)).toBe(false); // World internal check
    expect(diedSpy).toHaveBeenCalledWith({
      entityId: defender,
      killerId: attacker,
    });
  });

  it('should spawn loot on death based on loot table', () => {
    const attacker = world.createEntity();
    world.addComponent(attacker, Attack, { power: 20 });

    const defender = world.createEntity();
    world.addComponent(defender, Position, { x: 2, y: 2 });
    world.addComponent(defender, Health, { current: 5, max: 5 });
    world.addComponent(defender, LootTable, {
      drops: [{ template: 'gold', chance: 1.0 }] // Always drop
    });
    grid.addEntity(defender, 2, 2);

    eventBus.emit('BUMP_ATTACK', { attackerId: attacker, defenderId: defender });
    eventBus.flush();

    expect(entityFactory.create).toHaveBeenCalledWith(
      world,
      'gold',
      componentRegistry,
      { position: { x: 2, y: 2 } }
    );
    expect(grid.getItemsAt(2, 2).has(999 as any)).toBe(true);
  });

  it('should not spawn loot if chance fails', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.9);

    const attacker = world.createEntity();
    world.addComponent(attacker, Attack, { power: 20 });

    const defender = world.createEntity();
    world.addComponent(defender, Position, { x: 2, y: 2 });
    world.addComponent(defender, Health, { current: 5, max: 5 });
    world.addComponent(defender, LootTable, {
      drops: [{ template: 'gold', chance: 0.1 }] // Low chance
    });

    eventBus.emit('BUMP_ATTACK', { attackerId: attacker, defenderId: defender });
    eventBus.flush();

    expect(entityFactory.create).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });
});
