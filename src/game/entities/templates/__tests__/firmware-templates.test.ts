import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '@engine/ecs/world';
import { EventBus } from '@engine/events/event-bus';
import { EntityFactory } from '@engine/entity/factory';
import { EntityRegistry } from '@engine/entity/registry';
import { AbilityDef, Position } from '@shared/components';
import { ComponentRegistry } from '@engine/entity/types';
import { RawTemplate } from '@engine/entity/types';

import phaseShiftTemplate from '../phase-shift.json';
import neuralSpikeTemplate from '../neural-spike.json';
import extendedSightTemplate from '../extended-sight.json';

describe('Firmware Templates', () => {
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
      ['abilityDef', AbilityDef],
      ['position', Position],
    ]);

    componentRegistry = {
      get: (key: string) => components.get(key),
      has: (key: string) => components.has(key),
    };

    // Register templates
    entityRegistry.register(phaseShiftTemplate as unknown as RawTemplate);
    entityRegistry.register(neuralSpikeTemplate as unknown as RawTemplate);
    entityRegistry.register(extendedSightTemplate as unknown as RawTemplate);
  });

  describe('Template Parsing (Zod)', () => {
    it('phase-shift.json validates against AbilityDef schema', () => {
      const data = (phaseShiftTemplate as any).components.abilityDef;
      const parsed = AbilityDef.schema.parse(data);
      expect(parsed.name).toBe('Phase_Shift.sh');
      expect(parsed.heatCost).toBe(25);
      expect(parsed.effectType).toBe('dash');
      expect(parsed.dashDistance).toBe(5);
    });

    it('neural-spike.json validates against AbilityDef schema', () => {
      const data = (neuralSpikeTemplate as any).components.abilityDef;
      const parsed = AbilityDef.schema.parse(data);
      expect(parsed.name).toBe('Neural_Spike.exe');
      expect(parsed.heatCost).toBe(40);
      expect(parsed.effectType).toBe('ranged_attack');
      expect(parsed.range).toBe(6);
      expect(parsed.damageAmount).toBe(15);
    });

    it('extended-sight.json validates against AbilityDef schema', () => {
      const data = (extendedSightTemplate as any).components.abilityDef;
      const parsed = AbilityDef.schema.parse(data);
      expect(parsed.name).toBe('Extended_Sight.sys');
      expect(parsed.heatCost).toBe(10);
      expect(parsed.effectType).toBe('toggle_vision');
      expect(parsed.isToggle).toBe(true);
      expect(parsed.heatPerTurn).toBe(10);
      expect(parsed.visionRadius).toBe(12);
    });
  });

  describe('Entity Creation', () => {
    it('creates a valid phase_shift entity', () => {
      const entityId = entityFactory.create(world, 'phase_shift', componentRegistry);
      const ability = world.getComponent(entityId, AbilityDef);
      expect(ability).toBeDefined();
      expect(ability?.name).toBe('Phase_Shift.sh');
    });

    it('creates a valid neural_spike entity', () => {
      const entityId = entityFactory.create(world, 'neural_spike', componentRegistry);
      const ability = world.getComponent(entityId, AbilityDef);
      expect(ability).toBeDefined();
      expect(ability?.name).toBe('Neural_Spike.exe');
    });

    it('creates a valid extended_sight entity', () => {
      const entityId = entityFactory.create(world, 'extended_sight', componentRegistry);
      const ability = world.getComponent(entityId, AbilityDef);
      expect(ability).toBeDefined();
      expect(ability?.name).toBe('Extended_Sight.sys');
    });
  });

  describe('Legacy Code Stub', () => {
    it('parses isLegacy=true correctly', () => {
      const data = {
        name: 'Legacy.sh',
        heatCost: 10,
        range: 0,
        effectType: 'dash',
        isLegacy: true
      };
      const parsed = AbilityDef.schema.parse(data);
      expect(parsed.isLegacy).toBe(true);
    });

    it('defaults isLegacy to false', () => {
      const data = {
        name: 'New.sh',
        heatCost: 10,
        range: 0,
        effectType: 'dash'
      };
      const parsed = AbilityDef.schema.parse(data);
      expect(parsed.isLegacy).toBe(false);
    });
  });
});
