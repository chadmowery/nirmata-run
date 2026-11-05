import { describe, it, expect } from 'vitest';
import { generateDungeon } from '../../src/game/generation/dungeon-generator';
import { placeEntities } from '../../src/game/generation/entity-placement';
import { validateConnectivity } from '../../src/engine/generation/flood-fill';
import { World } from '../../src/engine/ecs/world';
import { EntityFactory } from '../../src/engine/entity/factory';
import { EntityRegistry } from '../../src/engine/entity/registry';
import { ComponentRegistry } from '../../src/engine/entity/types';
import { ComponentDef } from '../../src/engine/ecs/types';
import { registerGameTemplates } from '../../src/game/entities';
import { COMPONENTS_REGISTRY } from '@shared/components';
import { BlocksMovement, Position } from '@shared/components';
import { EventBus } from '../../src/engine/events/event-bus';
import { GameplayEvents } from '@shared/events/types';

describe('M10: Map Connectivity During Prop Placement Invariants', () => {
  function createHarness() {
    const eventBus = new EventBus<GameplayEvents>();
    const world = new World(eventBus);
    const entityRegistry = new EntityRegistry();
    registerGameTemplates(entityRegistry);
    const factory = new EntityFactory(entityRegistry);

    const componentsMap: Record<string, ComponentDef<unknown>> = Object.fromEntries(
      COMPONENTS_REGISTRY.map((c) => [c.key, c]),
    );
    const componentRegistry: ComponentRegistry = {
      get: (key: string) => componentsMap[key],
      has: (key: string) => !!componentsMap[key],
    };

    return { world, factory, componentRegistry };
  }

  it('guarantees 100% map connectivity after placing all props across random seeds and depths', () => {
    const depths = [1, 3, 6, 8, 10, 12, 15];
    const seeds = ['m10-seed-a', 'm10-seed-b', 'alpha-99', 'omega-01', 'stress-test-77'];

    for (const depth of depths) {
      for (const seed of seeds) {
        const { world, factory, componentRegistry } = createHarness();
        const dungeon = generateDungeon({
          width: 50,
          height: 50,
          depth,
          seed,
        });

        // Place entities including all blocking and interactive props
        const placement = placeEntities(
          world,
          dungeon.grid,
          factory,
          componentRegistry,
          dungeon.rooms,
          dungeon.playerSpawnRoom,
          { random: () => 0.5 },
          {
            depth,
            propAnchors: dungeon.propAnchors,
            factionTheme: dungeon.factionTheme,
            sectorCondition: dungeon.sectorCondition,
            bespokeRooms: dungeon.bespokeRooms,
            vaultFaradayBounds: dungeon.vaultFaradayBounds,
          },
        );

        expect(dungeon.propAnchors.length).toBeGreaterThan(0);
        expect(placement.propIds.length).toBeGreaterThan(0);

        // Collect all placed prop positions that block movement
        const blockingPropPositions = new Set<string>();
        for (const propId of placement.propIds) {
          if (world.hasComponent(propId, BlocksMovement)) {
            const pos = world.getComponent(propId, Position);
            if (pos) {
              blockingPropPositions.add(`${pos.x},${pos.y}`);
            }
          }
        }

        // Vault interiors are sealed behind locked doors until opened, so check non-vault connectivity
        const isInsideVault = (x: number, y: number): boolean => {
          if (!dungeon.vaultFaradayBounds || dungeon.vaultFaradayBounds.length === 0) return false;
          return dungeon.vaultFaradayBounds.some(
            (b) => x >= b.x && x < b.x + b.width && y >= b.y && y < b.y + b.height,
          );
        };

        const isPassable = (x: number, y: number): boolean => {
          if (!dungeon.grid.inBounds(x, y) || !dungeon.grid.isWalkable(x, y)) return false;
          if (blockingPropPositions.has(`${x},${y}`)) return false;
          if (isInsideVault(x, y)) return false;
          return true;
        };

        const conn = validateConnectivity(
          dungeon.grid.width,
          dungeon.grid.height,
          isPassable,
          dungeon.playerSpawnRoom.centerX,
          dungeon.playerSpawnRoom.centerY,
        );

        // CRITICAL INVARIANT: Non-vault walkable tiles MUST be 100% reachable from spawn room
        expect(conn.connected).toBe(true);
      }
    }
  });
});
