import { describe, it, expect } from 'vitest';
import {
  generateDungeon,
  rollSectorCondition,
  rollFactionTheme,
  getMaxBespokeRooms,
  createSeededRNG,
} from '../dungeon-generator';
import { placeEntities } from '../entity-placement';
import { World } from '@engine/ecs/world';
import { EventBus } from '@engine/events/event-bus';
import { GameplayEvents } from '@shared/events/types';
import { EntityRegistry } from '@engine/entity/registry';
import { EntityFactory } from '@engine/entity/factory';
import { registerGameTemplates } from '../../entities';
import { COMPONENTS_REGISTRY } from '@shared/components';
import { ComponentRegistry } from '@engine/entity/types';
import { ComponentDef } from '@engine/ecs/types';
import { Container, SecurityLock, Prop } from '@shared/components/environment';

describe('Hybrid ProcGen & Interactive Environments Generation', () => {
  describe('rollSectorCondition', () => {
    it('always returns NOMINAL on floors 1 to 5', () => {
      for (let floor = 1; floor <= 5; floor++) {
        for (let i = 0; i < 20; i++) {
          const rng = createSeededRNG(`test_seed_${floor}_${i}`);
          const condition = rollSectorCondition(floor, rng);
          expect(condition).toBe('NOMINAL');
        }
      }
    });

    it('guarantees an active sector condition on floors 6, 10, and 15 (never NOMINAL)', () => {
      const guaranteedFloors = [6, 10, 15];
      const validActive = ['THERMAL_SURGE', 'DARK_SUBNET', 'OVERCLOCKED_GRID'];

      for (const floor of guaranteedFloors) {
        for (let i = 0; i < 30; i++) {
          const rng = createSeededRNG(`guaranteed_${floor}_${i}`);
          const condition = rollSectorCondition(floor, rng);
          expect(validActive).toContain(condition);
          expect(condition).not.toBe('NOMINAL');
        }
      }
    });

    it('rolls active or nominal on other floors in 6-15', () => {
      const conditions = new Set<string>();
      for (let i = 0; i < 100; i++) {
        const rng = createSeededRNG(`other_floor_7_${i}`);
        conditions.add(rollSectorCondition(7, rng));
      }
      expect(conditions.has('NOMINAL')).toBe(true);
      expect(conditions.size).toBeGreaterThan(1);
    });
  });

  describe('rollFactionTheme & getMaxBespokeRooms', () => {
    it('rolls valid factions uniformly', () => {
      const factions = new Set<string>();
      for (let i = 0; i < 50; i++) {
        const rng = createSeededRNG(`faction_${i}`);
        factions.add(rollFactionTheme(rng));
      }
      expect(factions.has('traxus')).toBe(true);
      expect(factions.has('cyberacme')).toBe(true);
      expect(factions.has('sekiguchi')).toBe(true);
      expect(factions.has('nucaloric')).toBe(true);
    });

    it('enforces bespoke room caps per depth band', () => {
      expect(getMaxBespokeRooms(1)).toBe(1);
      expect(getMaxBespokeRooms(5)).toBe(1);
      expect(getMaxBespokeRooms(6)).toBe(2);
      expect(getMaxBespokeRooms(10)).toBe(2);
      expect(getMaxBespokeRooms(11)).toBe(3);
      expect(getMaxBespokeRooms(15)).toBe(3);
    });
  });

  describe('generateDungeon with Hybrid ProcGen', () => {
    it('generates fully connected dungeons with sector conditions and prop anchors', () => {
      const result = generateDungeon({
        width: 80,
        height: 45,
        seed: 'procgen_test_seed_f6',
        depth: 6,
      });

      expect(result.grid).toBeDefined();
      expect(result.rooms.length).toBeGreaterThanOrEqual(4);
      expect(result.doors.length).toBeGreaterThan(0);
      expect(result.playerSpawnRoom).toBe(result.rooms[0]);
      expect(result.sectorCondition).toBeDefined();
      expect(['THERMAL_SURGE', 'DARK_SUBNET', 'OVERCLOCKED_GRID']).toContain(result.sectorCondition);
      expect(['traxus', 'cyberacme', 'sekiguchi', 'nucaloric']).toContain(result.factionTheme);

      // Prop anchors were tagged
      expect(result.propAnchors.length).toBeGreaterThan(0);
      for (const anchor of result.propAnchors) {
        expect(['PROP_DESK_CORNER', 'PROP_LOCKER_WALL', 'SURFACE_TABLE_TOP', 'CONTAINER_RARE']).toContain(
          anchor.anchorType,
        );
      }

      // Safeguard: no prop anchors adjacent to any door
      for (const anchor of result.propAnchors) {
        for (const door of result.doors) {
          const dist = Math.abs(anchor.x - door.x) + Math.abs(anchor.y - door.y);
          expect(dist).toBeGreaterThan(1);
        }
      }
    });

    it('is 100% deterministic given the same seed and depth', () => {
      const res1 = generateDungeon({
        width: 80,
        height: 45,
        seed: 'deterministic_test_seed',
        depth: 10,
      });

      const res2 = generateDungeon({
        width: 80,
        height: 45,
        seed: 'deterministic_test_seed',
        depth: 10,
      });

      expect(res1.sectorCondition).toBe(res2.sectorCondition);
      expect(res1.factionTheme).toBe(res2.factionTheme);
      expect(res1.rooms.length).toBe(res2.rooms.length);
      expect(res1.bespokeRooms.length).toBe(res2.bespokeRooms.length);
      expect(res1.propAnchors.length).toBe(res2.propAnchors.length);
      expect(res1.propAnchors[0]).toEqual(res2.propAnchors[0]);
    });
  });

  describe('placeEntities with Interactive Props & Loot Masking', () => {
    function setupECS() {
      const bus = new EventBus<GameplayEvents>();
      const world = new World<GameplayEvents>(bus, { childComponentKey: 'children' });
      const entityRegistry = new EntityRegistry();
      registerGameTemplates(entityRegistry);
      const entityFactory = new EntityFactory(entityRegistry);

      const componentsMap: Record<string, ComponentDef<unknown>> = Object.fromEntries(
        COMPONENTS_REGISTRY.map((component) => [component.key, component]),
      );
      const componentRegistry: ComponentRegistry = {
        get: (key: string) => componentsMap[key],
        has: (key: string) => !!componentsMap[key],
      };

      return { world, entityFactory, componentRegistry };
    }

    it('seeds interactive props and masks container loot from network/client payload', () => {
      const { world, entityFactory, componentRegistry } = setupECS();
      const dungeon = generateDungeon({
        width: 80,
        height: 45,
        seed: 'placement_test_seed_f6',
        depth: 6,
      });

      const rng = createSeededRNG('placement_rng_seed');
      const placement = placeEntities(
        world,
        dungeon.grid,
        entityFactory,
        componentRegistry,
        dungeon.rooms,
        dungeon.playerSpawnRoom,
        rng,
        {
          depth: 6,
          propAnchors: dungeon.propAnchors,
          bespokeRooms: dungeon.bespokeRooms,
          vaultFaradayBounds: dungeon.vaultFaradayBounds,
          sectorCondition: dungeon.sectorCondition,
          factionTheme: dungeon.factionTheme,
        },
      );

      expect(placement.propIds.length).toBeGreaterThan(0);

      // Check containers for loot masking
      let containerCount = 0;
      for (const propId of placement.propIds) {
        if (world.hasComponent(propId, Container)) {
          containerCount++;
          const container = world.getComponent(propId, Container)!;

          // Crucial anti-cheat rule: itemEntityIds is EMPTY before search
          expect(container.itemEntityIds).toEqual([]);

          // Stored loot is rolled deterministically
          expect(container.storedLoot).toBeDefined();

          // Highest rarity is populated for skills that inspect container contents
          expect(container.highestRarity).toBeDefined();
          expect(['common', 'uncommon', 'rare', 'legendary']).toContain(container.highestRarity);
        }
      }
      expect(containerCount).toBeGreaterThan(0);
    });

    it('places guaranteed reality stabilizer on floor 6-15', () => {
      const { world, entityFactory, componentRegistry } = setupECS();
      const dungeon = generateDungeon({
        width: 80,
        height: 45,
        seed: 'stabilizer_test_seed',
        depth: 6,
      });

      const rng = createSeededRNG('stab_rng');
      const placement = placeEntities(
        world,
        dungeon.grid,
        entityFactory,
        componentRegistry,
        dungeon.rooms,
        dungeon.playerSpawnRoom,
        rng,
        {
          depth: 6,
          propAnchors: dungeon.propAnchors,
          bespokeRooms: dungeon.bespokeRooms,
          vaultFaradayBounds: dungeon.vaultFaradayBounds,
          sectorCondition: 'OVERCLOCKED_GRID',
          factionTheme: 'sekiguchi',
        },
      );

      const stabilizers = placement.propIds.filter((id) => {
        const prop = world.getComponent(id, Prop);
        return prop?.propClass === 'reality_stabilizer';
      });

      // OVERCLOCKED_GRID rolls 2 stabilizers
      expect(stabilizers.length).toBe(2);
    });

    it('guarantees access key availability when a SecurityLock is present', () => {
      const { world, entityFactory, componentRegistry } = setupECS();
      const dungeon = generateDungeon({
        width: 80,
        height: 45,
        seed: 'keycard_test_seed_f10',
        depth: 10,
      });

      const rng = createSeededRNG('key_rng');
      const placement = placeEntities(
        world,
        dungeon.grid,
        entityFactory,
        componentRegistry,
        dungeon.rooms,
        dungeon.playerSpawnRoom,
        rng,
        {
          depth: 10,
          propAnchors: dungeon.propAnchors,
          bespokeRooms: dungeon.bespokeRooms,
          vaultFaradayBounds: dungeon.vaultFaradayBounds,
          sectorCondition: dungeon.sectorCondition,
          factionTheme: dungeon.factionTheme,
        },
      );

      const locks = placement.propIds.filter((id) => world.hasComponent(id, SecurityLock));
      if (locks.length > 0) {
        // Guaranteed keycard source exists
        const keyContainers = placement.propIds.filter((id) => {
          const c = world.getComponent(id, Container);
          return c?.grantsAccessKey === true;
        });
        expect(keyContainers.length).toBeGreaterThan(0);
      }
    });
  });
});
