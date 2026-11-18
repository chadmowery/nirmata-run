import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AIBehaviorRegistry } from '@/game/ai/tree-registry';
import { hotloadBus } from '@/server/dev/hotload-bus';
import {
  getDepthBand,
  getDepthConfig,
  setDepthConfig,
} from '@/game/generation/dungeon-generator';
import {
  getLootDistributionConfig,
  setLootDistributionConfig,
  getDepthDistributionConfig,
  setDepthDistributionConfig,
} from '@/game/generation/entity-placement';
import {
  getPrefabsForFloor,
  upsertPrefab,
  removePrefab,
  type RoomPrefabTemplate,
} from '@/game/generation/prefabs';
import { getDefaultEntityRegistry } from '@/game/entities';
import {
  upsertEntityTemplateInRegistries,
  upsertMixinInRegistries,
} from '@/server/dev/hotload-reconciler';
import { sessionManager } from '@/server/session/session-manager';
import { World } from '@engine/ecs/world';
import { EventBus } from '@engine/events/event-bus';
import { Grid } from '@engine/grid/grid';
import { TurnManager } from '@engine/turn/turn-manager';
import { EntityRegistry } from '@engine/entity/registry';
import { EntityFactory } from '@engine/entity/factory';
import type { EngineEvents } from '@engine/events/types';

vi.mock('@/server/security/env-gate', () => ({
  checkNonProductionOnly: vi.fn(() => null),
}));

vi.mock('../utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../utils')>();
  return {
    ...actual,
    atomicWrite: vi.fn(async () => {}),
  };
});

import { PUT as putAiTree } from '../ai-trees/[treeId]/route';

describe('Live Server Registry Refresh (HIGH-02)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    AIBehaviorRegistry.loadDefaults();
  });

  it('PUT /api/dev/gamedata/ai-trees/[treeId] validates schema, updates AIBehaviorRegistry, and publishes to hotloadBus', async () => {
    const events: unknown[] = [];
    const unsub = hotloadBus.subscribe((env) => events.push(env));

    const updatedRoot = {
      type: 'ACTION' as const,
      task: { action: 'WAIT' as const },
    };

    const req = new Request('http://localhost/api/dev/gamedata/ai-trees/null_pointer', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'null_pointer', root: updatedRoot }),
    });
    const res = await putAiTree(req, { params: Promise.resolve({ treeId: 'null_pointer' }) });
    unsub();

    expect(res.status).toBe(200);
    expect(AIBehaviorRegistry.getTree('null_pointer')).toEqual(updatedRoot);
    expect(events).toHaveLength(1);
    expect((events[0] as { domain: string; targetId: string }).domain).toBe('aiTree');
    expect((events[0] as { targetId: string }).targetId).toBe('null_pointer');
  });

  it('PUT /api/dev/gamedata/ai-trees/[treeId] rejects invalid behavior tree schema with 400', async () => {
    const req = new Request('http://localhost/api/dev/gamedata/ai-trees/basic', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'basic', root: { type: 'NOT_A_NODE' } }),
    });
    const res = await putAiTree(req, { params: Promise.resolve({ treeId: 'basic' }) });
    expect(res.status).toBe(400);
  });

  it('runtime setters update depthConfig, lootDistribution, depthDistribution, and prefabs in memory', () => {
    const origDepth = getDepthConfig();
    const nextDepth = {
      ...origDepth,
      depthBands: [
        {
          ...origDepth.depthBands[0],
          label: 'HOTLOAD_TEST_BAND',
          range: { min: 1, max: 15 },
        },
      ],
    };
    setDepthConfig(nextDepth);
    expect(getDepthBand(1)?.label).toBe('HOTLOAD_TEST_BAND');
    setDepthConfig(origDepth);

    const origLoot = getLootDistributionConfig();
    setLootDistributionConfig({
      ...origLoot,
      depthBands: [{ depthRange: { min: 1, max: 15 }, loot: [{ template: 'flux', weight: 10 }] }],
    });
    expect(getLootDistributionConfig().depthBands[0].loot[0].template).toBe('flux');
    setLootDistributionConfig(origLoot);

    const origSpawn = getDepthDistributionConfig();
    setDepthDistributionConfig({
      ...origSpawn,
      tables: [
        {
          ...origSpawn.tables[0],
          enemiesPerRoom: { min: 3, max: 4 },
        },
      ],
    });
    expect(getDepthDistributionConfig().tables[0].enemiesPerRoom.min).toBe(3);
    setDepthDistributionConfig(origSpawn);

    const customPrefab: RoomPrefabTemplate = {
      id: 'hotload-test-prefab',
      name: 'Hotload Test Room',
      faction: 'traxus',
      minFloor: 1,
      maxFloor: 1,
      width: 8,
      height: 8,
      layout: Array(8).fill('########'),
      portals: [{ x: 0, y: 4, direction: 'west' }],
      propSpawns: [],
    };
    upsertPrefab(customPrefab);
    expect(getPrefabsForFloor(1, 'traxus').some((p) => p.id === 'hotload-test-prefab')).toBe(true);
    removePrefab('hotload-test-prefab');
    expect(getPrefabsForFloor(1, 'traxus').some((p) => p.id === 'hotload-test-prefab')).toBe(false);
  });

  it('upsertEntityTemplateInRegistries and upsertMixinInRegistries update default and active session registries', () => {
    sessionManager.clear();
    const bus = new EventBus<EngineEvents>();
    const world = new World<EngineEvents>(bus);
    const grid = new Grid(10, 10);
    const turnManager = new TurnManager(
      world,
      bus,
      { energyThreshold: 1000, defaultActionCost: 1000, waitActionCost: 500 },
      {
        getCandidateActors: () => [],
        isActorActive: () => true,
        canActorAct: () => true,
        accumulateEnergy: () => {},
        deductActionCost: () => {},
        isPrimaryActor: (id) => id === 1,
        getPrimaryActor: () => 1,
      },
    );
    const sessRegistry = new EntityRegistry();
    const entityFactory = new EntityFactory(sessRegistry);
    const player = world.createEntity();

    sessionManager.createSession('reg-sess', {
      world,
      grid,
      turnManager,
      eventBus: bus,
      playerId: player,
      entityRegistry: sessRegistry,
      entityFactory,
    });

    upsertEntityTemplateInRegistries({
      name: 'hotload-new-drone',
      components: { sprite: { key: 'enemy_null_pointer' } },
    });
    upsertMixinInRegistries('hotload-new-mixin', {
      name: 'hotload-new-mixin',
      components: { blocksMovement: {} },
    });

    expect(getDefaultEntityRegistry().has('hotload-new-drone')).toBe(true);
    expect(sessRegistry.has('hotload-new-drone')).toBe(true);
    expect(getDefaultEntityRegistry().has('hotload-new-mixin')).toBe(true);
    expect(sessRegistry.has('hotload-new-mixin')).toBe(true);

    sessionManager.clear();
  });
});
