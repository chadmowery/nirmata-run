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
    get: (key: string) =>
      Object.values(Components).find(
        (c) => c && typeof c === 'object' && 'key' in c && (c as any).key === key,
      ) as any,
    has: (key: string) =>
      Object.values(Components).some(
        (c) => c && typeof c === 'object' && 'key' in c && (c as any).key === key,
      ),
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
      components: { position: { x: 1, y: 1 } },
    });

    const id = factory.create(world, 'robot', componentRegistry);
    expect(world.hasComponent(id, Position)).toBe(true);
    expect(world.getComponent(id, Position)).toEqual({ x: 1, y: 1 });
  });

  it('applies runtime overrides during creation', () => {
    registry.register({
      name: 'robot',
      components: { position: { x: 1, y: 1 } },
    });

    const id = factory.create(world, 'robot', componentRegistry, {
      position: { x: 5, y: 10 },
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

      // Matches player.json overrides (180)
      expect(world.getComponent(id, Health)).toEqual({ current: 180, max: 180, isAlive: true });
    });

    it('creates a health-potion without health component', () => {
      const id = factory.create(world, 'health-potion', componentRegistry);
      expect(world.hasComponent(id, Position)).toBe(true);
      expect(world.hasComponent(id, Health)).toBe(false);
    });

    it('validates game templates during creation', () => {
      // Manually register a malformed template to test validation integration
      registry.register({
        name: 'bad_bot',
        components: { health: { current: -1, max: 0 } },
      });

      expect(() => factory.create(world, 'bad_bot', componentRegistry)).toThrow(/too small/i);
    });

    it('creates rifle-v1 through rifle-v3 and armor-v1 through armor-v3 without errors', () => {
      const equipmentTemplates = [
        'rifle-v1',
        'rifle-v2',
        'rifle-v3',
        'armor-v1',
        'armor-v2',
        'armor-v3',
      ];
      for (const tName of equipmentTemplates) {
        const id = factory.create(world, tName, componentRegistry);
        expect(world.hasComponent(id, Components.EquipmentDef)).toBe(true);
        expect(world.hasComponent(id, Components.Item)).toBe(true);
        expect(world.hasComponent(id, Components.SpriteComponent)).toBe(true);
        expect(world.hasComponent(id, Components.RarityTier)).toBe(true);
      }
    });

    it('creates dead-zone successfully', () => {
      const id = factory.create(world, 'dead-zone', componentRegistry);
      expect(world.hasComponent(id, Components.DeadZone)).toBe(true);
      expect(world.hasComponent(id, Components.SpriteComponent)).toBe(true);
    });

    it('successfully creates all registered game templates without unknown component errors', () => {
      // Test all templates that don't require non-standard runtime overrides
      const templates = (registry as any).templates as Map<string, any>;
      for (const [name, template] of templates.entries()) {
        // Skip mixins
        if (name === 'physical' || name === 'combatant') continue;

        expect(() => {
          factory.create(world, name, componentRegistry);
        }).not.toThrow();
      }
    });
  });
});
