import { describe, it, expect } from 'vitest';
import { World } from '@engine/ecs/world';
import { EventBus } from '@engine/events/event-bus';
import { GameplayEvents } from '@shared/events/types';
import {
  FactionThemeSchema,
  SectorConditionSchema,
  Prop,
  SecurityLock,
  Container,
  InteractiveSurface,
  CorruptedNode,
  InteractPropIntent,
  PropInteractedThisTurn,
  FloorState,
  ConditionNodeSchema,
  COMPONENTS_REGISTRY,
} from '../index';
import { serializeWorld, deserializeWorld } from '../../serialization';

describe('Environment ECS Components & Schemas', () => {
  describe('FactionThemeSchema & SectorConditionSchema', () => {
    it('validates faction themes', () => {
      expect(FactionThemeSchema.safeParse('traxus').success).toBe(true);
      expect(FactionThemeSchema.safeParse('cyberacme').success).toBe(true);
      expect(FactionThemeSchema.safeParse('sekiguchi').success).toBe(true);
      expect(FactionThemeSchema.safeParse('nucaloric').success).toBe(true);
      expect(FactionThemeSchema.safeParse('system').success).toBe(true);
      expect(FactionThemeSchema.safeParse('unknown_corp').success).toBe(false);
    });

    it('validates sector conditions', () => {
      expect(SectorConditionSchema.safeParse('NOMINAL').success).toBe(true);
      expect(SectorConditionSchema.safeParse('THERMAL_SURGE').success).toBe(true);
      expect(SectorConditionSchema.safeParse('DARK_SUBNET').success).toBe(true);
      expect(SectorConditionSchema.safeParse('OVERCLOCKED_GRID').success).toBe(true);
      expect(SectorConditionSchema.safeParse('IRRADIATED').success).toBe(false);
    });
  });

  describe('Prop component', () => {
    it('creates Prop with defaults', () => {
      const parsed = Prop.schema.safeParse({
        propId: 'ws_01',
        faction: 'cyberacme',
        propClass: 'workstation',
      });
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.isSearched).toBe(false);
        expect(parsed.data.heatCostOnAccess).toBe(0);
        expect(parsed.data.ventAmount).toBe(0);
        expect(parsed.data.stabilityRestoreAmount).toBe(0);
        expect(parsed.data.deadDropFluxCost).toBe(25);
      }
    });

    it('creates special utility props with custom costs', () => {
      const parsed = Prop.schema.safeParse({
        propId: 'cool_01',
        faction: 'nucaloric',
        propClass: 'cooling_vent',
        ventAmount: 40,
        heatCostOnAccess: 0,
      });
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.ventAmount).toBe(40);
        expect(parsed.data.propClass).toBe('cooling_vent');
      }
    });
  });

  describe('SecurityLock component', () => {
    it('creates SecurityLock with default breach values and faraday bounds', () => {
      const parsed = SecurityLock.schema.safeParse({
        faradayBounds: { x: 10, y: 10, width: 8, height: 8 },
      });
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.isLocked).toBe(true);
        expect(parsed.data.keyIdRequired).toBe('access_key');
        expect(parsed.data.overclockHeatCost).toBe(35);
        expect(parsed.data.alertRadiusOnBypass).toBe(12);
        expect(parsed.data.faradayBounds).toEqual({ x: 10, y: 10, width: 8, height: 8 });
      }
    });
  });

  describe('Container component', () => {
    it('creates Container with stored loot and highestRarity for vision skills', () => {
      const parsed = Container.schema.safeParse({
        containerId: 'c_vault_01',
        capacity: 4,
        highestRarity: 'rare',
        scrapYield: 25,
        fluxYield: 10,
        grantsAccessKey: true,
        storedLoot: [
          { templateId: 'rifle-v2', rarityTier: 'rare' },
          { templateId: 'armor-v1', rarityTier: 'uncommon' },
        ],
      });
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.highestRarity).toBe('rare');
        expect(parsed.data.itemEntityIds).toEqual([]);
        expect(parsed.data.storedLoot?.length).toBe(2);
        expect(parsed.data.grantsAccessKey).toBe(true);
      }
    });
  });

  describe('InteractiveSurface component', () => {
    it('validates cover reduction and volatile hazards', () => {
      const parsed = InteractiveSurface.schema.safeParse({
        surfaceId: 'crate_01',
        providesCover: true,
        coverDamageReduction: 0.25,
        destructible: true,
        hazardOnDestroy: 'cryo_spill',
        cascadeRadius: 2,
      });
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.coverDamageReduction).toBe(0.25);
        expect(parsed.data.hazardOnDestroy).toBe('cryo_spill');
        expect(parsed.data.cascadeRadius).toBe(2);
      }
    });
  });

  describe('CorruptedNode component', () => {
    it('validates corruption traps and disarm state', () => {
      const parsed = CorruptedNode.schema.safeParse({
        corruptionLevel: 2,
        trapType: 'acoustic_alert',
      });
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.isDisarmed).toBe(false);
        expect(parsed.data.triggered).toBe(false);
        expect(parsed.data.revealed).toBe(false);
      }
    });
  });

  describe('FloorState extended fields', () => {
    it('supports sector conditions, keys, and environmental telemetry metrics', () => {
      const parsed = FloorState.schema.safeParse({
        currentFloor: 6,
        runSeed: 'seed_abc',
        sectorCondition: 'THERMAL_SURGE',
        accessKeysHeld: 1,
        vaultsBreached: 2,
        trapsDisarmed: 1,
      });
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.sectorCondition).toBe('THERMAL_SURGE');
        expect(parsed.data.accessKeysHeld).toBe(1);
        expect(parsed.data.vaultsBreached).toBe(2);
        expect(parsed.data.trapsDisarmed).toBe(1);
      }
    });

    it('falls back to NOMINAL and 0 defaults', () => {
      const parsed = FloorState.schema.safeParse({
        currentFloor: 1,
        runSeed: 'seed_abc',
      });
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.sectorCondition).toBe('NOMINAL');
        expect(parsed.data.accessKeysHeld).toBe(0);
        expect(parsed.data.vaultsBreached).toBe(0);
        expect(parsed.data.trapsDisarmed).toBe(0);
      }
    });
  });

  describe('ConditionNodeSchema with environmental triggers', () => {
    it('parses ON_HACK and ON_COVER_BROKEN triggers', () => {
      const hackCondition = ConditionNodeSchema.safeParse({ type: 'ON_HACK' });
      const coverCondition = ConditionNodeSchema.safeParse({ type: 'ON_COVER_BROKEN' });
      const composite = ConditionNodeSchema.safeParse({
        type: 'AND',
        conditions: [{ type: 'ON_HACK' }, { type: 'ON_OVERCLOCK' }],
      });

      expect(hackCondition.success).toBe(true);
      expect(coverCondition.success).toBe(true);
      expect(composite.success).toBe(true);
    });
  });

  describe('ECS World Registration & Serialization Roundtrip', () => {
    it('is registered in COMPONENTS_REGISTRY', () => {
      const keys = COMPONENTS_REGISTRY.map((c) => c.key);
      expect(keys).toContain('prop');
      expect(keys).toContain('securityLock');
      expect(keys).toContain('container');
      expect(keys).toContain('interactiveSurface');
      expect(keys).toContain('corruptedNode');
      expect(keys).toContain('interactPropIntent');
      expect(keys).toContain('propInteractedThisTurn');
    });

    it('serializes and deserializes an entity with environment components cleanly', () => {
      const bus = new EventBus<GameplayEvents>();
      const world = new World<GameplayEvents>(bus);

      const propEntity = world.createEntity();
      world.addComponent(propEntity, Prop, {
        propId: 'safe_01',
        faction: 'traxus',
        propClass: 'encrypted_safe',
        isSearched: false,
        heatCostOnAccess: 0,
        ventAmount: 0,
        stabilityRestoreAmount: 0,
        deadDropFluxCost: 25,
      });
      world.addComponent(propEntity, SecurityLock, {
        isLocked: true,
        keyIdRequired: 'access_key',
        overclockHeatCost: 35,
        alertRadiusOnBypass: 12,
      });
      world.addComponent(propEntity, Container, {
        containerId: 'c_safe_01',
        capacity: 4,
        highestRarity: 'rare',
        itemEntityIds: [],
        scrapYield: 30,
        fluxYield: 15,
        grantsAccessKey: false,
      });

      const serialized = serializeWorld(world);
      expect(serialized.stores['prop']).toBeDefined();
      expect(serialized.stores['securityLock']).toBeDefined();
      expect(serialized.stores['container']).toBeDefined();

      const newWorld = deserializeWorld(serialized, bus);
      expect(newWorld.hasComponent(propEntity, Prop)).toBe(true);
      expect(newWorld.hasComponent(propEntity, SecurityLock)).toBe(true);
      expect(newWorld.hasComponent(propEntity, Container)).toBe(true);

      const restoredProp = newWorld.getComponent(propEntity, Prop);
      expect(restoredProp?.propClass).toBe('encrypted_safe');
      const restoredLock = newWorld.getComponent(propEntity, SecurityLock);
      expect(restoredLock?.isLocked).toBe(true);
      const restoredContainer = newWorld.getComponent(propEntity, Container);
      expect(restoredContainer?.highestRarity).toBe('rare');
    });
  });
});
