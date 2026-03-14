import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '../ecs/world';
import { EntityRegistry } from './registry';
import { resolveMixins, buildEntity } from './builder';
import { defineComponent } from '../ecs/types';
import { z } from 'zod';
import { ComponentRegistry } from './types';
import { EventBus } from '../events/event-bus';
import { EngineEvents } from '../events/types';

describe('Entity Builder', () => {
  let world: World;
  let registry: EntityRegistry;
  let eventBus: EventBus<EngineEvents>;
  
  const Position = defineComponent('position', z.object({ x: z.number(), y: z.number() }));
  const Health = defineComponent('health', z.object({ current: z.number().int().min(0), max: z.number().int().positive() }));
  
  const componentRegistry: ComponentRegistry = {
    get: (key: string) => {
      if (key === 'position') return Position;
      if (key === 'health') return Health;
      return undefined;
    },
    has: (key: string) => key === 'position' || key === 'health'
  };

  beforeEach(() => {
    eventBus = new EventBus<EngineEvents>();
    world = new World(eventBus);
    registry = new EntityRegistry();
  });

  describe('resolveMixins', () => {
    it('resolves a simple template with no mixins', () => {
      const template = {
        name: 'test',
        components: { position: { x: 10, y: 20 } }
      };
      const resolved = resolveMixins(template, registry);
      expect(resolved).toEqual({ position: { x: 10, y: 20 } });
    });

    it('inherits components from a mixin', () => {
      registry.register({
        name: 'base',
        components: { position: { x: 0, y: 0 } }
      });
      const template = {
        name: 'player',
        mixins: ['base'],
        components: { health: { current: 10, max: 10 } }
      };
      const resolved = resolveMixins(template, registry);
      expect(resolved).toEqual({
        position: { x: 0, y: 0 },
        health: { current: 10, max: 10 }
      });
    });

    it('template components override mixin components with same key', () => {
      registry.register({
        name: 'base',
        components: { position: { x: 0, y: 0 } }
      });
      const template = {
        name: 'player',
        mixins: ['base'],
        components: { position: { x: 10, y: 10 } }
      };
      const resolved = resolveMixins(template, registry);
      expect(resolved.position).toEqual({ x: 10, y: 10 });
    });

    it('applies overrides with deep merge', () => {
      registry.register({
        name: 'base',
        components: { health: { current: 10, max: 10 } }
      });
      const template = {
        name: 'player',
        mixins: ['base'],
        components: {},
        overrides: { health: { current: 20 } }
      };
      const resolved = resolveMixins(template, registry);
      expect(resolved.health).toEqual({ current: 20, max: 10 });
    });

    it('resolves nested mixins recursively', () => {
      registry.register({
        name: 'level1',
        components: { position: { x: 1, y: 1 } }
      });
      registry.register({
        name: 'level2',
        mixins: ['level1'],
        components: { health: { current: 5, max: 5 } }
      });
      const template = {
        name: 'level3',
        mixins: ['level2'],
        components: { extra: 'data' }
      };
      const resolved = resolveMixins(template, registry);
      expect(resolved).toEqual({
        position: { x: 1, y: 1 },
        health: { current: 5, max: 5 },
        extra: 'data'
      });
    });

    it('throws on circular mixin reference', () => {
      registry.register({
        name: 'A',
        mixins: ['B'],
        components: {}
      });
      registry.register({
        name: 'B',
        mixins: ['A'],
        components: {}
      });
      const template = {
        name: 'A',
        mixins: ['B'],
        components: {}
      };
      expect(() => resolveMixins(template, registry)).toThrow(/Circular mixin reference/);
    });

    it('throws when mixin depth exceeded', () => {
      registry.register({ name: 'D1', components: {} });
      registry.register({ name: 'D2', mixins: ['D1'], components: {} });
      registry.register({ name: 'D3', mixins: ['D2'], components: {} });
      const template = {
        name: 'D4',
        mixins: ['D3'],
        components: {}
      };
      expect(() => resolveMixins(template, registry, 3)).toThrow(/Mixin depth exceeded/);
    });

    it('throws on conflicting components across mixins', () => {
      registry.register({
        name: 'M1',
        components: { collision: true }
      });
      registry.register({
        name: 'M2',
        components: { collision: false }
      });
      const template = {
        name: 'Conflicted',
        mixins: ['M1', 'M2'],
        components: {}
      };
      expect(() => resolveMixins(template, registry)).toThrow(/defined in multiple mixins/);
    });
  });

  describe('buildEntity', () => {
    it('creates an entity with all components', () => {
      const resolved = {
        position: { x: 5, y: 5 },
        health: { current: 10, max: 10 }
      };
      const id = buildEntity(world, 'player', resolved, componentRegistry);
      
      expect(world.hasComponent(id, Position)).toBe(true);
      expect(world.hasComponent(id, Health)).toBe(true);
      expect(world.getComponent(id, Position)).toEqual({ x: 5, y: 5 });
      expect(world.getComponent(id, Health)).toEqual({ current: 10, max: 10 });
    });

    it('throws on unknown component', () => {
      const resolved = { unknown: { foo: 'bar' } };
      expect(() => buildEntity(world, 'test', resolved, componentRegistry)).toThrow(/unknown component/);
    });

    it('throws on Zod validation failure', () => {
      const resolved = {
        position: { x: 'invalid', y: 5 }
      };
      expect(() => buildEntity(world, 'test', resolved, componentRegistry)).toThrow(/expected number/i);
    });
  });
});
