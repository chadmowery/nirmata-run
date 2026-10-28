import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '@engine/ecs/world';
import { Grid } from '@engine/grid/grid';
import { EventBus } from '@engine/events/event-bus';
import { GameplayEvents } from '@shared/events/types';
import { Actor, Position, Health, Attack, Hostile } from '@shared/components';
import { MoveIntent, AttackIntent, COMPONENTS_REGISTRY } from '@shared/components';
import { registerCoreSystems } from '@game/systems/registration';
import { EntityRegistry } from '@engine/entity/registry';
import { EntityFactory } from '@engine/entity/factory';
import { ComponentRegistry } from '@engine/entity/types';
import { Phase, ComponentDef } from '@engine/ecs/types';
import { registerGameTemplates } from '@game/entities';

describe('Intent Resolution - Core Systems Integration', () => {
  let world: World<GameplayEvents>;
  let grid: Grid;
  let eventBus: EventBus<GameplayEvents>;

  beforeEach(() => {
    eventBus = new EventBus<GameplayEvents>();
    world = new World<GameplayEvents>(eventBus);
    grid = new Grid(10, 10);

    const dummyEntityRegistry = new EntityRegistry();
    registerGameTemplates(dummyEntityRegistry);
    const dummyEntityFactory = new EntityFactory(dummyEntityRegistry);
    const dummyComponentRegistry: ComponentRegistry = {
      get: (key: string) => COMPONENTS_REGISTRY.find((c) => c.key === key) as ComponentDef<unknown> | undefined,
      has: (key: string) => COMPONENTS_REGISTRY.some((c) => c.key === key),
    };

    registerCoreSystems(world, grid, eventBus, dummyEntityFactory, dummyComponentRegistry, {
      skipLoot: true,
    });
  });

  describe('Movement and Combat Resolution', () => {
    it('should resolve MoveIntent in ACTION phase', () => {
      const id = world.createEntity();
      world.addComponent(id, Actor, { isPlayer: true });
      world.addComponent(id, Position, { x: 5, y: 5 });
      grid.addEntity(id, 5, 5);

      world.addComponent(id, MoveIntent, { dx: 1, dy: 0 });

      world.executeSystems(Phase.ACTION);

      const pos = world.getComponent(id, Position);
      expect(pos).toEqual({ x: 6, y: 5 });
      expect(grid.getEntitiesAt(6, 5).has(id)).toBe(true);
      expect(world.hasComponent(id, MoveIntent)).toBe(false);
    });

    it('should resolve AttackIntent and deal damage in ACTION phase', () => {
      const attackerId = world.createEntity();
      world.addComponent(attackerId, Actor, { isPlayer: true });
      world.addComponent(attackerId, Position, { x: 5, y: 5 });
      world.addComponent(attackerId, Attack, { power: 5 });
      grid.addEntity(attackerId, 5, 5);

      const targetId = world.createEntity();
      world.addComponent(targetId, Hostile, {});
      world.addComponent(targetId, Position, { x: 6, y: 5 });
      world.addComponent(targetId, Health, { current: 10, max: 10, isAlive: true });
      grid.addEntity(targetId, 6, 5);

      world.addComponent(attackerId, AttackIntent, { targetId });

      world.executeSystems(Phase.ACTION);
      world.executeSystems(Phase.REACTION);

      const targetHealth = world.getComponent(targetId, Health);
      expect(targetHealth?.current).toBe(5);
      expect(world.hasComponent(attackerId, AttackIntent)).toBe(false);
    });

    it('should not move into occupied tile', () => {
      const p1 = world.createEntity();
      world.addComponent(p1, Actor, { isPlayer: true });
      world.addComponent(p1, Position, { x: 5, y: 5 });
      grid.addEntity(p1, 5, 5);

      const p2 = world.createEntity();
      world.addComponent(p2, Hostile, {});
      world.addComponent(p2, Position, { x: 6, y: 5 });
      grid.addEntity(p2, 6, 5);

      world.addComponent(p1, MoveIntent, { dx: 1, dy: 0 });

      world.executeSystems(Phase.ACTION);

      const pos = world.getComponent(p1, Position);
      expect(pos).toEqual({ x: 5, y: 5 });
      expect(world.hasComponent(p1, MoveIntent)).toBe(false);
    });

    it('should emit DAMAGE_DEALT and ENTITY_DIED events on lethal attack', () => {
      let damageDealtEmitted = false;
      let entityDiedEmitted = false;

      eventBus.on('DAMAGE_DEALT', () => {
        damageDealtEmitted = true;
      });
      eventBus.on('ENTITY_DIED', () => {
        entityDiedEmitted = true;
      });

      const attackerId = world.createEntity();
      world.addComponent(attackerId, Actor, { isPlayer: true });
      world.addComponent(attackerId, Position, { x: 5, y: 5 });
      world.addComponent(attackerId, Attack, { power: 10 });
      grid.addEntity(attackerId, 5, 5);

      const targetId = world.createEntity();
      world.addComponent(targetId, Hostile, {});
      world.addComponent(targetId, Position, { x: 6, y: 5 });
      world.addComponent(targetId, Health, { current: 5, max: 5, isAlive: true });
      grid.addEntity(targetId, 6, 5);

      world.addComponent(attackerId, AttackIntent, { targetId });

      world.executeSystems(Phase.ACTION);
      world.executeSystems(Phase.REACTION);
      eventBus.flush();

      expect(damageDealtEmitted).toBe(true);
      expect(entityDiedEmitted).toBe(true);
    });

    it('should remove dead entities in CLEANUP phase via Gravedigger', () => {
      const targetId = world.createEntity();
      world.addComponent(targetId, Hostile, {});
      world.addComponent(targetId, Position, { x: 6, y: 5 });
      world.addComponent(targetId, Health, { current: 0, max: 5, isAlive: false });
      grid.addEntity(targetId, 6, 5);

      // Attack to mark dying or let combat system mark it
      const attackerId = world.createEntity();
      world.addComponent(attackerId, Actor, { isPlayer: true });
      world.addComponent(attackerId, Position, { x: 5, y: 5 });
      world.addComponent(attackerId, Attack, { power: 10 });
      grid.addEntity(attackerId, 5, 5);
      world.addComponent(attackerId, AttackIntent, { targetId });

      world.executeSystems(Phase.ACTION);
      world.executeSystems(Phase.REACTION);
      world.executeSystems(Phase.CLEANUP);

      expect(world.query().includes(targetId)).toBe(false);
      expect(grid.getEntitiesAt(6, 5).size).toBe(0);
    });

    it('should process turn without errors when no intents exist', () => {
      expect(() => {
        world.executeSystems(Phase.PRE_TURN);
        world.executeSystems(Phase.GATHER_INTENT);
        world.executeSystems(Phase.ACTION);
        world.executeSystems(Phase.REACTION);
        world.executeSystems(Phase.CLEANUP);
        world.executeSystems(Phase.POST_TURN);
      }).not.toThrow();
    });
  });
});
