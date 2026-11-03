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
import { Container, SecurityLock, Prop, CorruptedNode } from '@shared/components/environment';
import { Position } from '@shared/components/position';
import { Item } from '@shared/components/item';
import { serializeWorld } from '@shared/serialization';
import { createECSWorldDelta } from '@shared/ecs-delta';

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
      expect(locks.length).toBeGreaterThan(0);

      const keyContainers = placement.propIds.filter((id) => {
        const c = world.getComponent(id, Container);
        return c?.grantsAccessKey === true;
      });
      const keyItems = placement.itemIds.filter((id) => {
        const it = world.getComponent(id, Item);
        return it?.type === 'key';
      });
      expect(keyContainers.length + keyItems.length).toBeGreaterThanOrEqual(locks.length);
    });

    it('C2 Integration: walks real generated floors (F6-F15), asserting on lock presence, key reachability, key-count >= lock-count, and Faraday bounds matching their own vault', () => {
      let totalFloorsWithLocks = 0;
      let totalVaultDoorsSpawned = 0;

      for (let depth = 6; depth <= 15; depth++) {
        for (let s = 0; s < 5; s++) {
          const { world, entityFactory, componentRegistry } = setupECS();
          const seed = `real_floor_sweep_d${depth}_s${s}`;
          const dungeon = generateDungeon({
            width: 80,
            height: 45,
            seed,
            depth,
          });

          const rng = createSeededRNG(`real_placement_${seed}`);
          const placement = placeEntities(
            world,
            dungeon.grid,
            entityFactory,
            componentRegistry,
            dungeon.rooms,
            dungeon.playerSpawnRoom,
            rng,
            {
              depth,
              propAnchors: dungeon.propAnchors,
              bespokeRooms: dungeon.bespokeRooms,
              vaultFaradayBounds: dungeon.vaultFaradayBounds,
              sectorCondition: dungeon.sectorCondition,
              factionTheme: dungeon.factionTheme,
            },
          );

          // Check for locked props
          const lockedProps = placement.propIds.filter((id) => {
            const lock = world.getComponent(id, SecurityLock);
            return lock?.isLocked === true;
          });

          if (lockedProps.length > 0) {
            totalFloorsWithLocks++;

            // Count reachable keys (key-granting containers + ground key items)
            const keyContainers = placement.propIds.filter((id) => {
              const c = world.getComponent(id, Container);
              return c?.grantsAccessKey === true;
            });
            const keyItems = placement.itemIds.filter((id) => {
              const it = world.getComponent(id, Item);
              return it?.type === 'key';
            });

            const totalKeys = keyContainers.length + keyItems.length;
            // Key count must be >= lock count
            expect(totalKeys).toBeGreaterThanOrEqual(lockedProps.length);

            // Key reachability: keys must NOT spawn inside locked vault rooms
            const vaultBounds = dungeon.vaultFaradayBounds;
            for (const cId of keyContainers) {
              const pos = world.getComponent(cId, Position)!;
              for (const vb of vaultBounds) {
                const inside =
                  pos.x >= vb.x &&
                  pos.x < vb.x + vb.width &&
                  pos.y >= vb.y &&
                  pos.y < vb.y + vb.height;
                expect(inside).toBe(false);
              }
            }
            for (const kId of keyItems) {
              const pos = world.getComponent(kId, Position)!;
              for (const vb of vaultBounds) {
                const inside =
                  pos.x >= vb.x &&
                  pos.x < vb.x + vb.width &&
                  pos.y >= vb.y &&
                  pos.y < vb.y + vb.height;
                expect(inside).toBe(false);
              }
            }

            // Verify Faraday bounds match their own vault
            for (const lockId of lockedProps) {
              const lock = world.getComponent(lockId, SecurityLock)!;
              const pos = world.getComponent(lockId, Position)!;
              if (lock.faradayBounds) {
                const b = lock.faradayBounds;
                const matches =
                  pos.x >= b.x - 1 &&
                  pos.x <= b.x + b.width &&
                  pos.y >= b.y - 1 &&
                  pos.y <= b.y + b.height;
                expect(matches).toBe(true);
              }
            }
          }

          // Verify prop-vault-door entity is spawned when zero-day-vault is stamped
          const hasVaultPrefab = dungeon.bespokeRooms.some((br) => br.prefabId === 'zero-day-vault');
          if (hasVaultPrefab) {
            const vaultDoors = placement.propIds.filter((id) => {
              const prop = world.getComponent(id, Prop);
              return prop?.propClass === 'vault_door';
            });
            expect(vaultDoors.length).toBeGreaterThanOrEqual(1);
            totalVaultDoorsSpawned += vaultDoors.length;
          }
        }
      }

      // Assert that across F6-F15 real floors contain locks and vault doors
      expect(totalFloorsWithLocks).toBeGreaterThan(0);
      expect(totalVaultDoorsSpawned).toBeGreaterThan(0);
    });

    it('C3 Integration: Serialized FULL and DELTA payloads contain no storedLoot, scrapYield, fluxYield, grantsAccessKey, or unrevealed trapType', () => {
      const { world, entityFactory, componentRegistry } = setupECS();
      const dungeon = generateDungeon({
        width: 80,
        height: 45,
        seed: 'c3_network_redaction_seed_f8',
        depth: 8,
      });

      const rng = createSeededRNG('c3_rng');
      const placement = placeEntities(
        world,
        dungeon.grid,
        entityFactory,
        componentRegistry,
        dungeon.rooms,
        dungeon.playerSpawnRoom,
        rng,
        {
          depth: 8,
          propAnchors: dungeon.propAnchors,
          bespokeRooms: dungeon.bespokeRooms,
          vaultFaradayBounds: dungeon.vaultFaradayBounds,
          sectorCondition: dungeon.sectorCondition,
          factionTheme: dungeon.factionTheme,
        },
      );

      // Verify that the server's in-memory world has containers with secret rolls
      let containerCount = 0;
      for (const propId of placement.propIds) {
        if (world.hasComponent(propId, Container)) {
          containerCount++;
          const container = world.getComponent(propId, Container)!;
          expect(container.storedLoot).toBeDefined();
        }
      }
      expect(containerCount).toBeGreaterThan(0);

      // Verify at least one corrupted node is present
      const corruptedNodes = placement.propIds.filter((id) => world.hasComponent(id, CorruptedNode));
      expect(corruptedNodes.length).toBeGreaterThan(0);

      // 1. FULL payload check with client redaction
      const clientFullWorld = serializeWorld(world, { redactForClient: true });

      // Check all container components in serialized world
      const containerStore = clientFullWorld.stores['container'] || {};
      for (const [entityId, compData] of Object.entries(containerStore)) {
        const c = compData as Record<string, unknown>;
        expect(c.storedLoot, `Entity ${entityId} container must not have storedLoot`).toBeUndefined();
        expect(c.scrapYield, `Entity ${entityId} container must not have scrapYield`).toBeUndefined();
        expect(c.fluxYield, `Entity ${entityId} container must not have fluxYield`).toBeUndefined();
        expect(c.grantsAccessKey, `Entity ${entityId} container must not have grantsAccessKey`).toBeUndefined();
        expect(c.blueprintId, `Entity ${entityId} container must not have blueprintId`).toBeUndefined();
        expect(c.blueprintType, `Entity ${entityId} container must not have blueprintType`).toBeUndefined();
      }

      // Check all corruptedNode components in serialized world
      const corruptedStore = clientFullWorld.stores['corruptedNode'] || {};
      for (const [entityId, compData] of Object.entries(corruptedStore)) {
        const node = compData as Record<string, unknown>;
        if (!node.revealed) {
          expect(node.trapType, `Entity ${entityId} unrevealed node must not have trapType`).toBeUndefined();
        }
      }

      // 2. DELTA payload check with client redaction
      const emptyWorld = serializeWorld(new World<GameplayEvents>(new EventBus()));
      const clientDelta = createECSWorldDelta(emptyWorld, serializeWorld(world), { redactForClient: true });

      for (const compItem of clientDelta.componentsSet) {
        if (compItem.component === 'container') {
          const c = compItem.data as Record<string, unknown>;
          expect(c.storedLoot).toBeUndefined();
          expect(c.scrapYield).toBeUndefined();
          expect(c.fluxYield).toBeUndefined();
          expect(c.grantsAccessKey).toBeUndefined();
          expect(c.blueprintId).toBeUndefined();
          expect(c.blueprintType).toBeUndefined();
        } else if (compItem.component === 'corruptedNode') {
          const node = compItem.data as Record<string, unknown>;
          if (!node.revealed) {
            expect(node.trapType).toBeUndefined();
          }
        }
      }
    });
  });
});
