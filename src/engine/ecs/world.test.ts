import { describe, it, expect, vi, beforeEach } from 'vitest';
import { World } from './world';
import { EventBus } from '../events/event-bus';
import { EngineEvents } from '../events/types';
import { defineComponent, Phase } from './types';
import { z } from 'zod';

describe('World', () => {
  let bus: EventBus<EngineEvents>;
  let world: World;

  const Position = defineComponent('Position', z.object({ x: z.number(), y: z.number() }));
  const Health = defineComponent('Health', z.object({ value: z.number() }));

  beforeEach(() => {
    bus = new EventBus<EngineEvents>();
    world = new World(bus);
  });

  describe('Entity Lifecycle', () => {
    it('should create entities with sequential IDs', () => {
      const id1 = world.createEntity();
      const id2 = world.createEntity();
      expect(id1).toBe(1);
      expect(id2).toBe(2);
    });

    it('should correctly report if an entity exists', () => {
      const id = world.createEntity();
      expect(world.entityExists(id)).toBe(true);
      expect(world.entityExists(999)).toBe(false);
    });

    it('should destroy entities', () => {
      const id = world.createEntity();
      world.destroyEntity(id);
      expect(world.entityExists(id)).toBe(false);
    });

    it('should be a no-op when destroying non-existent entities', () => {
      expect(() => world.destroyEntity(999)).not.toThrow();
    });

    it('should emit ENTITY_CREATED and ENTITY_DESTROYED events', () => {
      const handler = vi.fn();
      bus.on('ENTITY_CREATED', handler);
      bus.on('ENTITY_DESTROYED', handler);

      const id = world.createEntity();
      world.destroyEntity(id);
      bus.flush();

      expect(handler).toHaveBeenCalledTimes(2);
      expect(handler).toHaveBeenNthCalledWith(1, { entityId: id });
      expect(handler).toHaveBeenNthCalledWith(2, { entityId: id });
    });
  });

  describe('Component CRUD', () => {
    it('should add and get components', () => {
      const id = world.createEntity();
      const pos = { x: 10, y: 20 };
      world.addComponent(id, Position, pos);

      expect(world.getComponent(id, Position)).toEqual(pos);
      expect(world.hasComponent(id, Position)).toBe(true);
    });

    it('should return undefined for missing components', () => {
      const id = world.createEntity();
      expect(world.getComponent(id, Position)).toBeUndefined();
      expect(world.hasComponent(id, Position)).toBe(false);
    });

    it('should remove components', () => {
      const id = world.createEntity();
      world.addComponent(id, Position, { x: 0, y: 0 });
      world.removeComponent(id, Position);

      expect(world.getComponent(id, Position)).toBeUndefined();
      expect(world.hasComponent(id, Position)).toBe(false);
    });

    it('should throw when adding component to non-existent entity', () => {
      expect(() => world.addComponent(999, Position, { x: 0, y: 0 })).toThrow();
    });

    it('should support mutable references to component data', () => {
      const id = world.createEntity();
      const pos = { x: 10, y: 20 };
      world.addComponent(id, Position, pos);

      const retrievedPos = world.getComponent(id, Position)!;
      retrievedPos.x = 30;

      expect(world.getComponent(id, Position)!.x).toBe(30);
    });

    it('should emit COMPONENT_ADDED and COMPONENT_REMOVED events', () => {
      const handler = vi.fn();
      bus.on('COMPONENT_ADDED', handler);
      bus.on('COMPONENT_REMOVED', handler);

      const id = world.createEntity();
      world.addComponent(id, Position, { x: 0, y: 0 });
      world.removeComponent(id, Position);
      bus.flush();

      expect(handler).toHaveBeenCalledTimes(2);
    });

    it('should clean up components when entity is destroyed', () => {
      const id = world.createEntity();
      world.addComponent(id, Position, { x: 0, y: 0 });
      world.destroyEntity(id);

      expect(world.getComponent(id, Position)).toBeUndefined();
    });
  });

  describe('Queries', () => {
    it('should return all entities when query is empty', () => {
      world.createEntity();
      world.createEntity();
      expect(world.query()).toHaveLength(2);
    });

    it('should query entities with a specific component', () => {
      const id1 = world.createEntity();
      world.createEntity(); // id2
      world.addComponent(id1, Position, { x: 0, y: 0 });

      expect(world.query(Position)).toEqual([id1]);
    });

    it('should query entities with multiple components', () => {
      const id1 = world.createEntity();
      world.createEntity(); // id2
      world.createEntity(); // id3

      world.addComponent(id1, Position, { x: 0, y: 0 });
      world.addComponent(id1, Health, { value: 100 });

      expect(world.query(Position, Health)).toEqual([id1]);
    });

    it('should return empty array when no entities match query', () => {
      const id = world.createEntity();
      world.addComponent(id, Position, { x: 0, y: 0 });
      expect(world.query(Health)).toEqual([]);
    });

    it('should reflect entity destruction in query results', () => {
      const id = world.createEntity();
      world.addComponent(id, Position, { x: 0, y: 0 });
      expect(world.query(Position)).toEqual([id]);

      world.destroyEntity(id);
      expect(world.query(Position)).toEqual([]);
    });
  });

  describe('Systems', () => {
    it('should register and execute systems', () => {
      const system = vi.fn();
      world.registerSystem(Phase.ACTION, system);
      world.executeSystems(Phase.ACTION);

      expect(system).toHaveBeenCalledWith(world);
    });

    it('should execute systems in registration order', () => {
      const sequence: number[] = [];
      world.registerSystem(Phase.ACTION, () => sequence.push(1));
      world.registerSystem(Phase.ACTION, () => sequence.push(2));
      world.executeSystems(Phase.ACTION);

      expect(sequence).toEqual([1, 2]);
    });

    it('should not execute systems from other phases', () => {
      const actionSystem = vi.fn();
      const renderSystem = vi.fn();

      world.registerSystem(Phase.ACTION, actionSystem);
      world.registerSystem(Phase.RENDER, renderSystem);

      world.executeSystems(Phase.ACTION);
      expect(actionSystem).toHaveBeenCalled();
      expect(renderSystem).not.toHaveBeenCalled();
    });
  });
});
