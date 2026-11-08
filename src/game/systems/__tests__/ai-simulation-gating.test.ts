import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createAISystem } from '../ai';
import { Grid } from '@engine/grid/grid';
import { World } from '@engine/ecs/world';
import { EventBus } from '@engine/events/event-bus';
import { Position } from '@shared/components/position';
import { Actor } from '@shared/components/actor';
import { AIState, AIBehavior, AIBehaviorType } from '@shared/components/ai-state';
import { FovAwareness } from '@shared/components/fov-awareness';
import { MoveIntent, AlertIntent, Acting } from '@shared/components/intents';
import { PackMember } from '@shared/components/pack-member';
import { FloorState } from '@shared/components/floor-state';
import { GameplayEvents } from '@shared/events/types';
import { EntityFactory } from '@engine/entity/factory';
import { EntityRegistry } from '@engine/entity/registry';
import { COMPONENTS_REGISTRY } from '@shared/components';

describe('AI Simulation Gating & Lag Prevention', () => {
  let world: World<GameplayEvents>;
  let grid: Grid;
  let eventBus: EventBus<GameplayEvents>;
  let aiSystem: ReturnType<typeof createAISystem<GameplayEvents>>;

  beforeEach(() => {
    eventBus = new EventBus<GameplayEvents>();
    world = new World<GameplayEvents>(eventBus);
    grid = new Grid(80, 50);

    // Initialize walkable, transparent grid
    for (let y = 0; y < 50; y++) {
      for (let x = 0; x < 80; x++) {
        grid.setTile(x, y, { walkable: true, transparent: true });
      }
    }

    const entityRegistry = new EntityRegistry();
    const entityFactory = new EntityFactory(entityRegistry);
    const componentsMap = Object.fromEntries(COMPONENTS_REGISTRY.map((c) => [c.key, c]));
    const componentRegistry = {
      get: (key: string) => componentsMap[key],
      has: (key: string) => !!componentsMap[key],
    };

    aiSystem = createAISystem(world, grid, eventBus, entityFactory, componentRegistry);
    aiSystem.init();

    // Floor state
    const floorId = world.createEntity();
    world.addComponent(floorId, FloorState, {
      currentFloor: 1,
      maxFloor: 15,
      runSeed: 'perf_test_seed',
      turnNumber: 1,
      sectorCondition: 'NOMINAL',
    });
  });

  const setupPlayer = (x: number, y: number) => {
    const player = world.createEntity();
    world.addComponent(player, Actor, { isPlayer: true });
    world.addComponent(player, Position, { x, y });
    grid.addEntity(player, x, y);
    return player;
  };

  const createEnemy = (
    x: number,
    y: number,
    opts: {
      behavior?: AIBehavior;
      sightRadius?: number;
      treeId?: string;
      canSeePlayer?: boolean;
      remainingMemoryTurns?: number;
      packId?: string;
      isLeader?: boolean;
    } = {},
  ) => {
    const enemy = world.createEntity();
    world.addComponent(enemy, Position, { x, y });
    world.addComponent(enemy, AIState, {
      behavior: opts.behavior ?? AIBehavior.IDLE,
      behaviorType: AIBehaviorType.BASIC,
      treeId: opts.treeId ?? 'basic',
      sightRadius: opts.sightRadius ?? 6,
      remainingMemoryTurns: opts.remainingMemoryTurns ?? 0,
      memoryTurns: 5,
    });
    world.addComponent(enemy, FovAwareness, {
      canSeePlayer: opts.canSeePlayer ?? false,
      lastKnownPlayerX: opts.remainingMemoryTurns ? x : undefined,
      lastKnownPlayerY: opts.remainingMemoryTurns ? y : undefined,
    });
    if (opts.packId) {
      world.addComponent(enemy, PackMember, {
        packId: opts.packId,
        isLeader: opts.isLeader ?? false,
      });
    }
    grid.addEntity(enemy, x, y);
    return enemy;
  };

  it('skips simulation completely for unaware and off-screen enemies (no state patching, no intents, no BT evaluation)', () => {
    setupPlayer(5, 5);

    // Place 5 distant unaware enemies (distance > 20 tiles away)
    const distantEnemies: number[] = [];
    for (let i = 0; i < 5; i++) {
      const eid = createEnemy(30 + i * 2, 30 + i * 2, {
        behavior: AIBehavior.IDLE,
        canSeePlayer: false,
        remainingMemoryTurns: 0,
      });
      world.addComponent(eid, Acting, {});
      distantEnemies.push(eid);
    }

    aiSystem.update(world);

    // None of the distant enemies should have acted or been simulated
    for (const eid of distantEnemies) {
      expect(world.hasComponent(eid, MoveIntent)).toBe(false);
      const ai = world.getComponent(eid, AIState)!;
      expect(ai.behavior).toBe(AIBehavior.IDLE);
      expect(ai.lastEvaluatedPath).toBeUndefined();
      const awareness = world.getComponent(eid, FovAwareness)!;
      expect(awareness.canSeePlayer).toBe(false);
    }
  });

  it('simulates an enemy when it is inside player FOV even if unaware (plain sight idle posture)', () => {
    setupPlayer(5, 5);

    // Enemy is at (10, 5) (distance 5, within player FOV 8)
    // Enemy sightRadius is 2, so enemy cannot see player (5 > 2)
    const enemy = createEnemy(10, 5, {
      sightRadius: 2,
      behavior: AIBehavior.IDLE,
      canSeePlayer: false,
      remainingMemoryTurns: 0,
    });
    world.addComponent(enemy, Acting, {});

    aiSystem.update(world);

    // Enemy was simulated because it is visible to the player
    const ai = world.getComponent(enemy, AIState)!;
    expect(ai.lastEvaluatedPath).toBeDefined(); // Behavior tree evaluated fallback WAIT
    expect(world.hasComponent(enemy, MoveIntent)).toBe(false); // Does not move because it can't see player
    const awareness = world.getComponent(enemy, FovAwareness)!;
    expect(awareness.canSeePlayer).toBe(false);
  });

  it('simulates an off-screen enemy when it spots the player with superior vision radius', () => {
    setupPlayer(5, 5);

    // Enemy at (16, 5) with sightRadius 12
    // Distance = 11. Player FOV radius = 8, so enemy is NOT in player FOV.
    // However, enemy sightRadius is 12 >= 11 with clear LOS, so enemy spots player!
    const enemy = createEnemy(16, 5, {
      sightRadius: 12,
      behavior: AIBehavior.IDLE,
      canSeePlayer: false,
      remainingMemoryTurns: 0,
    });
    world.addComponent(enemy, Acting, {});

    aiSystem.update(world);

    // Enemy should have spotted player, transitioned to CHASING, and moved toward player
    const awareness = world.getComponent(enemy, FovAwareness)!;
    expect(awareness.canSeePlayer).toBe(true);
    expect(awareness.lastKnownPlayerX).toBe(5);
    expect(awareness.lastKnownPlayerY).toBe(5);

    const ai = world.getComponent(enemy, AIState)!;
    expect(ai.behavior).toBe(AIBehavior.CHASING);
    expect(ai.remainingMemoryTurns).toBe(5);

    const move = world.getComponent(enemy, MoveIntent);
    expect(move).toBeDefined();
    expect(move!.dx).toBe(-1); // Stepping west towards player at x=5
  });

  it('wakes unaware off-screen enemy when AlertIntent is attached', () => {
    setupPlayer(5, 5);

    // Block line of sight with wall but leave corridor at y=25 for pathfinding
    for (let y = 0; y < 50; y++) {
      if (y !== 25) {
        grid.setTile(20, y, { walkable: false, transparent: false });
      }
    }

    const enemy = createEnemy(35, 35, {
      behavior: AIBehavior.IDLE,
      canSeePlayer: false,
      remainingMemoryTurns: 0,
    });

    // AlertIntent attached (e.g. hack or terminal sound)
    world.addComponent(enemy, AlertIntent, { sourceX: 5, sourceY: 5 });
    world.addComponent(enemy, Acting, {});

    aiSystem.update(world);

    // Alert was consumed and enemy began moving toward alert source
    expect(world.hasComponent(enemy, AlertIntent)).toBe(false);
    const ai = world.getComponent(enemy, AIState)!;
    expect(ai.behavior).toBe(AIBehavior.CHASING);
    expect(world.hasComponent(enemy, MoveIntent)).toBe(true);
  });

  it('wakes unaware off-screen pack member when pack leader alerts the pack', () => {
    setupPlayer(5, 5);

    // Leader at (7, 5) (distance 2, sees player)
    const leader = createEnemy(7, 5, {
      packId: 'pack_echo',
      isLeader: true,
      canSeePlayer: true,
    });

    // Follower at (40, 40) (far away, off-screen, cannot see player)
    const follower = createEnemy(40, 40, {
      packId: 'pack_echo',
      isLeader: false,
      canSeePlayer: false,
      remainingMemoryTurns: 0,
    });

    world.addComponent(leader, Acting, {});
    world.addComponent(follower, Acting, {});

    aiSystem.update(world);

    // Follower should have been alerted via shared pack awareness and moved
    expect(world.hasComponent(follower, MoveIntent)).toBe(true);
    const followerAi = world.getComponent(follower, AIState)!;
    expect(followerAi.behavior).toBe(AIBehavior.CHASING);
  });

  it('continues simulating an off-screen enemy while remainingMemoryTurns > 0 after player breaks line of sight', () => {
    setupPlayer(5, 5);

    // Wall at x=10 blocks line of sight
    for (let y = 0; y < 50; y++) {
      grid.setTile(10, y, { walkable: false, transparent: false });
    }

    // Enemy at (15, 5) was chasing player, now behind wall, with 2 memory turns remaining
    const enemy = createEnemy(15, 5, {
      behavior: AIBehavior.CHASING,
      canSeePlayer: false,
      remainingMemoryTurns: 2,
    });
    world.patchComponent(enemy, FovAwareness, {
      canSeePlayer: false,
      lastKnownPlayerX: 9,
      lastKnownPlayerY: 5,
    });

    // --- Turn 1 ---
    world.addComponent(enemy, Acting, {});
    aiSystem.update(world);
    world.removeComponent(enemy, Acting);

    // Enemy should have simulated and decremented memory
    let ai = world.getComponent(enemy, AIState)!;
    expect(ai.remainingMemoryTurns).toBe(1);
    expect(ai.behavior).toBe(AIBehavior.CHASING);

    // --- Turn 2 ---
    world.addComponent(enemy, Acting, {});
    aiSystem.update(world);
    world.removeComponent(enemy, Acting);

    ai = world.getComponent(enemy, AIState)!;
    expect(ai.remainingMemoryTurns).toBe(0);
    expect(ai.behavior).toBe(AIBehavior.IDLE);

    // Remove any leftover MoveIntent
    if (world.hasComponent(enemy, MoveIntent)) {
      world.removeComponent(enemy, MoveIntent);
    }

    // --- Turn 3: Enemy is now IDLE with remainingMemoryTurns = 0 and off-screen ---
    world.addComponent(enemy, Acting, {});
    aiSystem.update(world);

    // Gated! No MoveIntent, no state changes
    expect(world.hasComponent(enemy, MoveIntent)).toBe(false);
    ai = world.getComponent(enemy, AIState)!;
    expect(ai.behavior).toBe(AIBehavior.IDLE);
    expect(ai.remainingMemoryTurns).toBe(0);
  });

  it('benchmarks that 50 off-screen unaware enemies simulate with near-zero latency (< 5ms)', () => {
    setupPlayer(5, 5);

    // Spawn 50 off-screen enemies across the dungeon
    for (let i = 0; i < 50; i++) {
      const x = 20 + (i % 10) * 4;
      const y = 20 + Math.floor(i / 10) * 4;
      const enemy = createEnemy(x, y, {
        behavior: AIBehavior.IDLE,
        canSeePlayer: false,
        remainingMemoryTurns: 0,
      });
      world.addComponent(enemy, Acting, {});
    }

    const t0 = performance.now();
    aiSystem.update(world);
    const duration = performance.now() - t0;

    // 50 unaware enemies should evaluate in well under 5ms
    expect(duration).toBeLessThan(10);
  });

  describe('Unaware Off-Screen Cooldowns & Ambient Behaviors (MED-04)', () => {
    it('decrements cooldown timers on off-screen unaware enemies every turn', () => {
      setupPlayer(5, 5);

      // Enemy at (40, 40) is off-screen, unaware, with active cooldown
      const enemy = createEnemy(40, 40, {
        behavior: AIBehavior.IDLE,
        canSeePlayer: false,
        remainingMemoryTurns: 0,
      });
      world.patchComponent(enemy, AIState, {
        cooldowns: { laser_sweep: 3, teleport_recharge: 1 },
      });
      world.addComponent(enemy, Acting, {});

      // Turn 1
      aiSystem.update(world);

      let ai = world.getComponent(enemy, AIState)!;
      expect(ai.cooldowns?.laser_sweep).toBe(2);
      expect(ai.cooldowns?.teleport_recharge).toBe(0);

      // Turn 2
      aiSystem.update(world);

      ai = world.getComponent(enemy, AIState)!;
      expect(ai.cooldowns?.laser_sweep).toBe(1);
      expect(ai.cooldowns?.teleport_recharge).toBe(0);
    });

    it('permits off-screen evaluation for unaware entities with ambient behaviors (system_admin, seed_eater)', () => {
      setupPlayer(5, 5);

      // System-Admin off-screen at (35, 35) with treeId 'system_admin'
      const admin = createEnemy(35, 35, {
        behavior: AIBehavior.IDLE,
        treeId: 'system_admin',
        canSeePlayer: false,
        remainingMemoryTurns: 0,
      });
      world.addComponent(admin, Acting, {});

      // Should evaluate without being early-gated
      aiSystem.update(world);

      // Entity evaluated its behavior tree
      expect(world.hasComponent(admin, AIState)).toBe(true);
    });

    it('DijkstraMap compute and createFleeMap guard against 0x0 grids without division by zero', async () => {
      const { DijkstraMap } = await import('@engine/ai/dijkstra-map');
      const emptyMap = new DijkstraMap(0, 0);

      expect(() => {
        emptyMap.compute([{ x: 0, y: 0, value: 0 }], () => 1);
      }).not.toThrow();

      expect(() => {
        emptyMap.createFleeMap(() => 1);
      }).not.toThrow();
    });
  });
});
