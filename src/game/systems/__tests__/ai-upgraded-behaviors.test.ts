import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createAISystem } from '../ai';
import { createSpawnEntitySystem } from '../spawn-entity';
import { createDeadZoneSystem } from '../dead-zone';
import { Grid } from '@engine/grid/grid';
import { World } from '@engine/ecs/world';
import { EventBus } from '@engine/events/event-bus';
import { Position } from '@shared/components/position';
import { Actor } from '@shared/components/actor';
import { Health } from '@shared/components/health';
import { AIState, AIBehavior, AIBehaviorType } from '@shared/components/ai-state';
import { FovAwareness } from '@shared/components/fov-awareness';
import { PackMember } from '@shared/components/pack-member';
import { MovedThisTurn } from '@shared/components/moved-this-turn';
import {
  MoveIntent,
  AttackIntent,
  TeleportIntent,
  SpawnEntityIntent,
  ApplyStatusEffectIntent,
  DamageIntent,
} from '@shared/components/intents';
import { SecurityLock, InteractiveSurface } from '@shared/components/environment';
import { Attack } from '@shared/components/attack';
import { StatusEffects } from '@shared/components/status-effects';
import { Dying } from '@shared/components/dying';
import { createCombatSystem } from '../combat';
import { createGravediggerSystem } from '../gravedigger';
import { createRunEnderSystem } from '../run-ender';
import { createMovementSystem } from '../movement';
import { GameplayEvents } from '@shared/events/types';
import { EntityFactory } from '@engine/entity/factory';
import { EntityRegistry } from '@engine/entity/registry';
import { COMPONENTS_REGISTRY } from '@shared/components';

describe('AI Behavior Trees & Dijkstra Maps Specification Verification', () => {
  let world: World<GameplayEvents>;
  let grid: Grid;
  let eventBus: EventBus<GameplayEvents>;
  let entityFactory: EntityFactory;
  let componentRegistry: { get: (k: string) => any; has: (k: string) => boolean };
  let aiSystem: ReturnType<typeof createAISystem<GameplayEvents>>;
  let spawnEntitySystem: ReturnType<typeof createSpawnEntitySystem<GameplayEvents>>;
  let deadZoneSystem: ReturnType<typeof createDeadZoneSystem<GameplayEvents>>;

  beforeEach(() => {
    eventBus = new EventBus<GameplayEvents>();
    world = new World<GameplayEvents>(eventBus);
    grid = new Grid(20, 20);

    for (let y = 0; y < 20; y++) {
      for (let x = 0; x < 20; x++) {
        grid.setTile(x, y, { walkable: true, transparent: true, terrain: 'floor' });
      }
    }

    const entityRegistry = new EntityRegistry();
    entityFactory = new EntityFactory(entityRegistry);

    entityRegistry.register({
      name: 'dead-zone',
      components: {
        deadZone: { remainingTurns: 6, damagePerTick: 2 },
        sprite: { key: 'dead_zone' },
      },
    });

    entityRegistry.register({
      name: 'prop-crate',
      components: {
        interactiveSurface: { providesCover: true, destructible: true },
        health: { current: 10, max: 10, isAlive: true },
        blocksMovement: {},
      },
    });

    const componentsMap = Object.fromEntries(COMPONENTS_REGISTRY.map((c) => [c.key, c]));
    componentRegistry = {
      get: (key: string) => componentsMap[key],
      has: (key: string) => !!componentsMap[key],
    };

    aiSystem = createAISystem(world, grid, eventBus, entityFactory, componentRegistry);
    spawnEntitySystem = createSpawnEntitySystem(world, grid, entityFactory, componentRegistry);
    deadZoneSystem = createDeadZoneSystem(world, grid);
  });

  const setupPlayer = (x: number, y: number, hp: number = 20) => {
    const player = world.createEntity();
    world.addComponent(player, Actor, { isPlayer: true });
    world.addComponent(player, Position, { x, y });
    world.addComponent(player, Health, { current: hp, max: hp, isAlive: true });
    grid.addEntity(player, x, y);
    return player;
  };

  describe('(1) Fragmenter Dead Zone Grid Registration & Tick Damage', () => {
    it('creates SpawnEntityIntent in Phase.GATHER_INTENT, registers Dead Zones on Grid in Phase.ACTION, and deals tick damage', () => {
      const player = setupPlayer(5, 5, 20);

      // Fragmenter at (4, 5) adjacent to player
      const fragmenter = world.createEntity();
      world.addComponent(fragmenter, Position, { x: 4, y: 5 });
      world.addComponent(fragmenter, AIState, {
        behavior: AIBehavior.IDLE,
        behaviorType: AIBehaviorType.FRAGMENTER,
        treeId: 'fragmenter',
        sightRadius: 6,
      });
      world.addComponent(fragmenter, FovAwareness, { canSeePlayer: true });
      grid.addEntity(fragmenter, 4, 5);

      // 1. Enemy Turn (Phase.GATHER_INTENT)
      aiSystem.processEnemyTurn(fragmenter);

      // Should have attached SpawnEntityIntent with 4 cardinal spawns around (4, 5)
      expect(world.hasComponent(fragmenter, SpawnEntityIntent)).toBe(true);
      const spawnIntent = world.getComponent(fragmenter, SpawnEntityIntent)!;
      expect(spawnIntent.spawns.length).toBeGreaterThanOrEqual(1);
      expect(spawnIntent.spawns.some((s) => s.x === 5 && s.y === 5)).toBe(true); // Player tile

      // 2. Intent Resolution (Phase.ACTION via SpawnEntitySystem)
      spawnEntitySystem.resolveSpawns();

      // Verify that dead-zone entities exist on the spatial grid
      const playerTileEntities = Array.from(grid.getEntitiesAt(5, 5));
      expect(playerTileEntities.length).toBeGreaterThan(1); // Player + DeadZone

      // 3. Hazard Tick (Phase.ACTION via DeadZoneSystem)
      deadZoneSystem.update(world);

      // DeadZone on player tile emitted DamageIntent
      const deadZoneId = playerTileEntities.find((id) => id !== player)!;
      const damageIntent = world.getComponent(deadZoneId, DamageIntent);
      expect(damageIntent).toBeDefined();
      expect(damageIntent!.targetId).toBe(player);
      expect(damageIntent!.amount).toBe(2);
    });
  });

  describe('(2) Logic-Leaker Corner Kiting & Cover Seeking', () => {
    it('retreats using flee_from_target when player is at close range (<= 2)', () => {
      setupPlayer(5, 5);

      // Logic-Leaker at (5, 4) — distance = 1
      const leaker = world.createEntity();
      world.addComponent(leaker, Position, { x: 5, y: 4 });
      world.addComponent(leaker, AIState, {
        behavior: AIBehavior.IDLE,
        behaviorType: AIBehaviorType.LOGIC_LEAKER,
        treeId: 'logic_leaker',
        sightRadius: 8,
      });
      world.addComponent(leaker, FovAwareness, { canSeePlayer: true });
      grid.addEntity(leaker, 5, 4);

      aiSystem.processEnemyTurn(leaker);

      // Logic-Leaker retreats (moves away from (5, 5), increasing distance from 1 to 2)
      const move = world.getComponent(leaker, MoveIntent);
      expect(move).toBeDefined();
      const newDist = Math.abs(5 - (5 + move!.dx)) + Math.abs(5 - (4 + move!.dy));
      expect(newDist).toBe(2);
    });

    it('fires corrupted packet with FIRMWARE_LOCK status at optimal range (3..5)', () => {
      const player = setupPlayer(5, 5);

      // Logic-Leaker at (5, 1) — distance = 4
      const leaker = world.createEntity();
      world.addComponent(leaker, Position, { x: 5, y: 1 });
      world.addComponent(leaker, AIState, {
        behavior: AIBehavior.IDLE,
        behaviorType: AIBehaviorType.LOGIC_LEAKER,
        treeId: 'logic_leaker',
        sightRadius: 8,
      });
      world.addComponent(leaker, FovAwareness, { canSeePlayer: true });
      grid.addEntity(leaker, 5, 1);

      aiSystem.processEnemyTurn(leaker);

      // Attacks player with ranged attack and applies status effect
      const attack = world.getComponent(leaker, AttackIntent);
      expect(attack).toBeDefined();
      expect(attack!.targetId).toBe(player);

      const statusIntent = world.getComponent(leaker, ApplyStatusEffectIntent);
      expect(statusIntent).toBeDefined();
      expect(statusIntent!.effect.name).toBe('FIRMWARE_LOCK');
      expect(statusIntent!.effect.duration).toBe(3);
    });
  });

  describe('(3) Buffer-Overflow Pack Coordination & FOV Gating', () => {
    it('follower does not swarm without LOS or shared pack alert', () => {
      setupPlayer(15, 15);

      // Follower at (2, 2) with wall blocking sight to player
      const follower = world.createEntity();
      world.addComponent(follower, Position, { x: 2, y: 2 });
      world.addComponent(follower, AIState, {
        behavior: AIBehavior.IDLE,
        behaviorType: AIBehaviorType.BUFFER_OVERFLOW,
        treeId: 'buffer_overflow',
        sightRadius: 6,
      });
      world.addComponent(follower, FovAwareness, { canSeePlayer: false });
      world.addComponent(follower, PackMember, { packId: 'pack_alpha', isLeader: false });
      grid.addEntity(follower, 2, 2);

      aiSystem.processEnemyTurn(follower);

      // Without LOS or alert, follower does not attack or move toward player
      expect(world.hasComponent(follower, MoveIntent)).toBe(false);
    });

    it('swarms toward player cardinal sides when pack alert is shared', () => {
      setupPlayer(5, 5);

      // Pack leader at (5, 8) spots player
      const leader = world.createEntity();
      world.addComponent(leader, Position, { x: 5, y: 8 });
      world.addComponent(leader, AIState, {
        behavior: AIBehavior.IDLE,
        behaviorType: AIBehaviorType.BUFFER_OVERFLOW,
        treeId: 'buffer_overflow',
        sightRadius: 6,
      });
      world.addComponent(leader, FovAwareness, { canSeePlayer: true });
      world.addComponent(leader, PackMember, { packId: 'pack_alpha', isLeader: true });
      grid.addEntity(leader, 5, 8);

      // Follower at (3, 3)
      const follower = world.createEntity();
      world.addComponent(follower, Position, { x: 3, y: 3 });
      world.addComponent(follower, AIState, {
        behavior: AIBehavior.IDLE,
        behaviorType: AIBehaviorType.BUFFER_OVERFLOW,
        treeId: 'buffer_overflow',
        sightRadius: 6,
      });
      world.addComponent(follower, FovAwareness, { canSeePlayer: false });
      world.addComponent(follower, PackMember, { packId: 'pack_alpha', isLeader: false });
      grid.addEntity(follower, 3, 3);

      // Update AI system to propagate pack alert
      aiSystem.update(world);

      // Follower is now alerted and pathfinds toward cardinal surround
      aiSystem.processEnemyTurn(follower);
      expect(world.hasComponent(follower, MoveIntent)).toBe(true);
    });
  });

  describe('(4) Null-Pointer Faraday-Safe Directional Ambush', () => {
    it('teleports behind the player relative to player movement vector', () => {
      const player = setupPlayer(5, 5);
      // Player moved East (+1, 0) from (4, 5) to (5, 5)
      world.addComponent(player, MovedThisTurn, { fromX: 4, fromY: 5, toX: 5, toY: 5 });

      // Null-Pointer at (5, 1) (distance = 4)
      const nullPointer = world.createEntity();
      world.addComponent(nullPointer, Position, { x: 5, y: 1 });
      world.addComponent(nullPointer, AIState, {
        behavior: AIBehavior.IDLE,
        behaviorType: AIBehaviorType.NULL_POINTER,
        treeId: 'null_pointer',
        sightRadius: 8,
        cooldowns: {},
      });
      world.addComponent(nullPointer, FovAwareness, { canSeePlayer: true });
      grid.addEntity(nullPointer, 5, 1);

      aiSystem.processEnemyTurn(nullPointer);

      // Should teleport behind player: player moved right (+1, 0), so behind is West (-1, 0) -> (4, 5)
      const teleport = world.getComponent(nullPointer, TeleportIntent);
      expect(teleport).toBeDefined();
      expect(teleport!.x).toBe(4);
      expect(teleport!.y).toBe(5);

      // Cooldown timer is started
      const aiState = world.getComponent(nullPointer, AIState);
      expect(aiState?.cooldowns?.phase_ambush).toBe(2);
    });

    it('does not teleport inside Faraday blast shield bounds', () => {
      const player = setupPlayer(5, 5);
      // Player moved East (+1, 0), so behind tile is (4, 5)
      world.addComponent(player, MovedThisTurn, { fromX: 4, fromY: 5, toX: 5, toY: 5 });

      // Faraday Shield active over (3..4, 4..6)
      const vaultDoor = world.createEntity();
      world.addComponent(vaultDoor, SecurityLock, {
        isLocked: true,
        faradayBounds: { x: 3, y: 4, width: 2, height: 3 }, // covers (4, 5)!
      });

      const nullPointer = world.createEntity();
      world.addComponent(nullPointer, Position, { x: 5, y: 1 });
      world.addComponent(nullPointer, AIState, {
        behavior: AIBehavior.IDLE,
        behaviorType: AIBehaviorType.NULL_POINTER,
        treeId: 'null_pointer',
        sightRadius: 8,
        cooldowns: {},
      });
      world.addComponent(nullPointer, FovAwareness, { canSeePlayer: true });
      grid.addEntity(nullPointer, 5, 1);

      aiSystem.processEnemyTurn(nullPointer);

      // If behind tile is inside Faraday bounds, candidate tile search picks an outside tile or moves
      const teleport = world.getComponent(nullPointer, TeleportIntent);
      if (teleport) {
        // Must NOT be inside the Faraday bounds
        const inside =
          teleport.x >= 3 && teleport.x < 5 && teleport.y >= 4 && teleport.y < 7;
        expect(inside).toBe(false);
      }
    });
  });

  describe('(5) System_Admin Prop Crushing', () => {
    it('emits AttackIntent to crush destructible InteractiveSurface prop blocking its path', () => {
      setupPlayer(5, 5);

      // System_Admin at (3, 5)
      const admin = world.createEntity();
      world.addComponent(admin, Position, { x: 3, y: 5 });
      world.addComponent(admin, AIState, {
        behavior: AIBehavior.IDLE,
        behaviorType: AIBehaviorType.SYSTEM_ADMIN,
        treeId: 'system_admin',
        sightRadius: 20,
      });
      world.addComponent(admin, FovAwareness, { canSeePlayer: true });
      grid.addEntity(admin, 3, 5);

      // Destructible crate prop at (4, 5) directly blocking downhill step to player
      const crate = world.createEntity();
      world.addComponent(crate, Position, { x: 4, y: 5 });
      world.addComponent(crate, InteractiveSurface, { surfaceId: 'crate_01', providesCover: true, destructible: true });
      world.addComponent(crate, Health, { current: 10, max: 10, isAlive: true });
      grid.addEntity(crate, 4, 5);

      aiSystem.processEnemyTurn(admin);

      // System_Admin should emit AttackIntent targeting the crate prop at (4, 5)
      const attack = world.getComponent(admin, AttackIntent);
      expect(attack).toBeDefined();
      expect(attack!.targetId).toBe(crate);
    });

    it('crushes destructible prop through CombatSystem and Gravedigger, then moves into cleared tile', () => {
      setupPlayer(5, 5);

      const combatSystem = createCombatSystem(world, grid, eventBus, entityFactory, componentRegistry);
      const gravedigger = createGravediggerSystem(world, grid);
      const movement = createMovementSystem(world, grid, eventBus, false);

      const admin = world.createEntity();
      world.addComponent(admin, Position, { x: 3, y: 5 });
      world.addComponent(admin, Attack, { power: 999 });
      world.addComponent(admin, AIState, {
        behavior: AIBehavior.IDLE,
        behaviorType: AIBehaviorType.SYSTEM_ADMIN,
        treeId: 'system_admin',
        sightRadius: 20,
      });
      world.addComponent(admin, FovAwareness, { canSeePlayer: true });
      grid.addEntity(admin, 3, 5);

      const crate = world.createEntity();
      world.addComponent(crate, Position, { x: 4, y: 5 });
      world.addComponent(crate, InteractiveSurface, { surfaceId: 'crate_01', providesCover: true, destructible: true });
      world.addComponent(crate, Health, { current: 10, max: 10, isAlive: true });
      grid.addEntity(crate, 4, 5);

      // Turn 1: AI decides to crush the crate
      aiSystem.processEnemyTurn(admin);
      expect(world.hasComponent(admin, AttackIntent)).toBe(true);

      // Combat resolves the attack and condemns the crate with Dying
      combatSystem.update(world);
      expect(world.hasComponent(admin, AttackIntent)).toBe(false);
      expect(world.hasComponent(crate, Dying)).toBe(true);

      // Gravedigger destroys the crate entity and cleans up grid
      gravedigger.update(world);
      expect(world.entityExists(crate)).toBe(false);
      expect(grid.getEntitiesAt(4, 5)).not.toContain(crate);

      // Turn 2: Path is clear, System_Admin moves into (4, 5)
      aiSystem.processEnemyTurn(admin);
      const moveIntent = world.getComponent(admin, MoveIntent);
      expect(moveIntent).toBeDefined();
      expect(moveIntent).toEqual({ dx: 1, dy: 0 });

      movement.update(world);
      const newPos = world.getComponent(admin, Position);
      expect(newPos).toEqual({ x: 4, y: 5 });
    });

    it('terminates run with FATAL: ADMIN_CONTACT when starting turn adjacent to player', () => {
      const player = setupPlayer(5, 5);

      const runEnder = createRunEnderSystem(world, grid, eventBus);
      runEnder.init();

      const runEndedSpy = vi.fn();
      eventBus.on('RUN_ENDED', runEndedSpy);

      const admin = world.createEntity();
      world.addComponent(admin, Position, { x: 4, y: 5 });
      world.addComponent(admin, Attack, { power: 999 });
      world.addComponent(admin, AIState, {
        behavior: AIBehavior.IDLE,
        behaviorType: AIBehaviorType.SYSTEM_ADMIN,
        treeId: 'system_admin',
        sightRadius: 20,
      });
      world.addComponent(admin, FovAwareness, { canSeePlayer: true });
      grid.addEntity(admin, 4, 5);

      // System_Admin takes turn while adjacent
      aiSystem.processEnemyTurn(admin);

      // RunEnderSystem update triggers ADMIN_CONTACT
      runEnder.update(world);
      eventBus.flush();

      expect(runEndedSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          reason: 'FATAL: ADMIN_CONTACT',
          entityId: player,
        }),
      );
    });

    it('emits disruption message and skips turn when afflicted with DISRUPT', () => {
      setupPlayer(5, 5);

      const messageSpy = vi.fn();
      eventBus.on('MESSAGE_EMITTED', messageSpy);

      const admin = world.createEntity();
      world.addComponent(admin, Position, { x: 3, y: 5 });
      world.addComponent(admin, AIState, {
        behavior: AIBehavior.IDLE,
        behaviorType: AIBehaviorType.SYSTEM_ADMIN,
        treeId: 'system_admin',
        sightRadius: 20,
      });
      world.addComponent(admin, FovAwareness, { canSeePlayer: true });
      world.addComponent(admin, StatusEffects, {
        effects: [{ name: 'DISRUPT', duration: 2, magnitude: 1 }],
      });
      grid.addEntity(admin, 3, 5);

      aiSystem.processEnemyTurn(admin);
      eventBus.flush();

      expect(world.hasComponent(admin, MoveIntent)).toBe(false);
      expect(world.hasComponent(admin, AttackIntent)).toBe(false);
      expect(messageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          text: 'System_Admin is disrupted and cannot move!',
          type: 'combat',
        }),
      );
    });
  });
});
