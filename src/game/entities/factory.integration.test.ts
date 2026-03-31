import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '../../engine/ecs/world';
import { EntityRegistry } from '../../engine/entity/registry';
import { EntityFactory } from '../../engine/entity/factory';
import { defineComponent } from '../../engine/ecs/types';
import { z } from 'zod';
import { ComponentRegistry } from '../../engine/entity/types';
import { EventBus } from '../../engine/events/event-bus';
import { EngineEvents } from '../../engine/events/types';
import { registerGameTemplates } from './index';

import * as Components from '@shared/components';

describe('EntityFactory', () => {
  let world: World;
  let registry: EntityRegistry;
  let factory: EntityFactory;
  let eventBus: EventBus<EngineEvents>;

  const { Position, Health } = Components;

  const componentRegistry: ComponentRegistry = {
    get: (key: string) => Object.values(Components).find(c => c && typeof c === 'object' && 'key' in c && (c as any).key === key) as any,
    has: (key: string) => Object.values(Components).some(c => c && typeof c === 'object' && 'key' in c && (c as any).key === key)
  };

  beforeEach(() => {
    eventBus = new EventBus<EngineEvents>();
    world = new World(eventBus);
    registry = new EntityRegistry();
    factory = new EntityFactory(registry);
  });

  it('creates an entity from a template', () => {
    registry.register({
      name: 'robot',
      components: { position: { x: 1, y: 1 } }
    });

    const id = factory.create(world, 'robot', componentRegistry);
    expect(world.hasComponent(id, Position)).toBe(true);
    expect(world.getComponent(id, Position)).toEqual({ x: 1, y: 1 });
  });

  it('applies runtime overrides during creation', () => {
    registry.register({
      name: 'robot',
      components: { position: { x: 1, y: 1 } }
    });

    const id = factory.create(world, 'robot', componentRegistry, {
      position: { x: 5, y: 10 }
    });
    expect(world.getComponent(id, Position)).toEqual({ x: 5, y: 10 });
  });

  it('throws for unknown template', () => {
    expect(() => factory.create(world, 'ghost', componentRegistry)).toThrow(/Unknown template/);
  });

  describe('Integration with Game Templates', () => {
    beforeEach(() => {
      registerGameTemplates(registry);
    });

    it('creates a player with correct components and overrides', () => {
      const id = factory.create(world, 'player', componentRegistry);
      
      expect(world.hasComponent(id, Position)).toBe(true);
      expect(world.hasComponent(id, Health)).toBe(true);
      
      // Inherited from physical mixin
      expect(world.getComponent(id, Position)).toEqual({ x: 0, y: 0 });
      
      // Overridden in player template (20 from 10)
      expect(world.getComponent(id, Health)).toEqual({ current: 20, max: 20 });
    });

    it('creates a goblin with correct health', () => {
      const id = factory.create(world, 'goblin', componentRegistry);
      expect(world.getComponent(id, Health)).toEqual({ current: 8, max: 8 });
    });

    it('creates a health potion without health component', () => {
      const id = factory.create(world, 'health-potion', componentRegistry);
      expect(world.hasComponent(id, Position)).toBe(true);
      expect(world.hasComponent(id, Health)).toBe(false);
    });

    it('validates game templates during creation', () => {
      // Manually register a malformed template to test validation integration
      registry.register({
        name: 'bad_bot',
        components: { health: { current: -1, max: 0 } }
      });

      expect(() => factory.create(world, 'bad_bot', componentRegistry)).toThrow(/too small/i);
    });
  });
});
