import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '@engine/ecs/world';
import { EventBus } from '@engine/events/event-bus';
import { EntityFactory } from '@engine/entity/factory';
import { EntityRegistry } from '@engine/entity/registry';
import { AugmentData } from '@shared/components/augment-data';
import { ComponentRegistry } from '@engine/entity/types';
import { RawTemplate } from '@engine/entity/types';

import displacementVentingTemplate from '../displacement-venting.json';
import staticSiphonTemplate from '../static-siphon.json';
import neuralFeedbackTemplate from '../neural-feedback.json';

describe('Augment Templates', () => {
  let world: World;
  let entityRegistry: EntityRegistry;
  let entityFactory: EntityFactory;
  let componentRegistry: ComponentRegistry;

  beforeEach(() => {
    world = new World(new EventBus());
    entityRegistry = new EntityRegistry();
    entityFactory = new EntityFactory(entityRegistry);

    // Mock component registry
    const components = new Map<string, any>([
      ['augmentData', AugmentData],
    ]);

    componentRegistry = {
      get: (key: string) => components.get(key),
      has: (key: string) => components.has(key),
    };

    // Register templates
    entityRegistry.register(displacementVentingTemplate as unknown as RawTemplate);
    entityRegistry.register(staticSiphonTemplate as unknown as RawTemplate);
    entityRegistry.register(neuralFeedbackTemplate as unknown as RawTemplate);
  });

  describe('Template Parsing (Zod)', () => {
    it('displacement-venting.json validates against AugmentData schema', () => {
      const data = (displacementVentingTemplate as any).components.augmentData;
      const parsed = AugmentData.schema.parse(data);
      expect(parsed.name).toBe('Displacement_Venting.arc');
      expect(parsed.trigger.type).toBe('ON_ACTIVATION');
      expect(parsed.payloads[0].type).toBe('VENT_HEAT');
      expect(parsed.payloads[0].magnitude).toBe(15);
      expect(parsed.maxTriggersPerTurn).toBe(1);
    });

    it('static-siphon.json validates against AugmentData schema', () => {
      const data = (staticSiphonTemplate as any).components.augmentData;
      const parsed = AugmentData.schema.parse(data);
      expect(parsed.name).toBe('Static_Siphon.arc');
      expect(parsed.trigger.type).toBe('AND');
      expect(parsed.trigger.conditions).toHaveLength(2);
      expect(parsed.trigger.conditions![0].type).toBe('ON_ACTIVATION');
      expect(parsed.trigger.conditions![1].type).toBe('ON_KILL');
      expect(parsed.payloads[0].type).toBe('SHIELD');
      expect(parsed.payloads[0].magnitude).toBe(5);
      expect(parsed.maxTriggersPerTurn).toBe(1);
    });

    it('neural-feedback.json validates against AugmentData schema', () => {
      const data = (neuralFeedbackTemplate as any).components.augmentData;
      const parsed = AugmentData.schema.parse(data);
      expect(parsed.name).toBe('Neural_Feedback.arc');
      expect(parsed.trigger.type).toBe('ON_KILL');
      expect(parsed.payloads[0].type).toBe('DAMAGE_BONUS');
      expect(parsed.payloads[0].magnitude).toBe(25);
      expect(parsed.payloads[0].statusEffectDuration).toBe(1);
      expect(parsed.maxTriggersPerTurn).toBe(1);
    });
  });

  describe('Entity Creation', () => {
    it('creates a valid displacement_venting entity', () => {
      const entityId = entityFactory.create(world, 'displacement_venting', componentRegistry);
      const data = world.getComponent(entityId, AugmentData);
      expect(data).toBeDefined();
      expect(data?.name).toBe('Displacement_Venting.arc');
    });

    it('creates a valid static_siphon entity', () => {
      const entityId = entityFactory.create(world, 'static_siphon', componentRegistry);
      const data = world.getComponent(entityId, AugmentData);
      expect(data).toBeDefined();
      expect(data?.name).toBe('Static_Siphon.arc');
    });

    it('creates a valid neural_feedback entity', () => {
      const entityId = entityFactory.create(world, 'neural_feedback', componentRegistry);
      const data = world.getComponent(entityId, AugmentData);
      expect(data).toBeDefined();
      expect(data?.name).toBe('Neural_Feedback.arc');
    });
  });
});
