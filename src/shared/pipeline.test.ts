import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '../engine/ecs/world';
import { Grid } from '../engine/grid/grid';
import { EventBus } from '../engine/events/event-bus';
import { GameplayEvents } from './events/types';
import { Actor, Position, Health, Attack, Hostile } from './components';
import { MoveIntent, AttackIntent, COMPONENTS_REGISTRY } from './components';
import { registerCoreSystems } from '../game/systems/registration';
import { EntityRegistry } from '../engine/entity/registry';
import { EntityFactory } from '../engine/entity/factory';
import { ComponentRegistry } from '../engine/entity/types';
import { Phase } from '../engine/ecs/types';

describe('Pipeline - Core Systems Integration', () => {
  let world: World<GameplayEvents>;
  let grid: Grid;
  let eventBus: EventBus<GameplayEvents>;

  beforeEach(() => {
    eventBus = new EventBus<GameplayEvents>();
    world = new World<GameplayEvents>(eventBus);
    grid = new Grid(10, 10);

    const dummyEntityRegistry = new EntityRegistry();
    const dummyEntityFactory = new EntityFactory(dummyEntityRegistry);
    const dummyComponentRegistry: ComponentRegistry = {
      get: (key: string) => COMPONENTS_REGISTRY.find(c => c.key === key) as any,
      has: (key: string) => COMPONENTS_REGISTRY.some(c => c.key === key),
    };

    registerCoreSystems(
      world,
      grid,
      eventBus,
      dummyEntityFactory,
      dummyComponentRegistry,
      { skipLoot: true }
    );
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

    it('should resolve AttackIntent in REACTION phase', () => {
      const attackerId = world.createEntity();
      world.addComponent(attackerId, Actor, { isPlayer: true });
      world.addComponent(attackerId, Attack, { power: 5 });

      const defenderId = world.createEntity();
      world.addComponent(defenderId, Actor, { isPlayer: false });
      world.addComponent(defenderId, Health, { current: 10, max: 10, isAlive: true });

      world.addComponent(attackerId, AttackIntent, { targetId: defenderId });
      
      world.executeSystems(Phase.REACTION);

      const health = world.getComponent(defenderId, Health);
      expect(health?.current).toBe(5);
      expect(world.hasComponent(attackerId, AttackIntent)).toBe(false);
    });

    it('should convert MoveIntent to AttackIntent on collision with hostile', () => {
      const playerId = world.createEntity();
      world.addComponent(playerId, Actor, { isPlayer: true });
      world.addComponent(playerId, Position, { x: 5, y: 5 });
      grid.addEntity(playerId, 5, 5);

      const enemyId = world.createEntity();
      world.addComponent(enemyId, Actor, { isPlayer: false });
      world.addComponent(enemyId, Hostile, {});
      world.addComponent(enemyId, Position, { x: 6, y: 5 });
      grid.addEntity(enemyId, 6, 5);

      world.addComponent(playerId, MoveIntent, { dx: 1, dy: 0 });
      
      // Phase.ACTION should convert MoveIntent -> AttackIntent
      world.executeSystems(Phase.ACTION);

      expect(world.hasComponent(playerId, MoveIntent)).toBe(false);
      expect(world.hasComponent(playerId, AttackIntent)).toBe(true);
      expect(world.getComponent(playerId, AttackIntent)?.targetId).toBe(enemyId);
      
      // Position should NOT have changed yet
      expect(world.getComponent(playerId, Position)).toEqual({ x: 5, y: 5 });
    });
  });
});
