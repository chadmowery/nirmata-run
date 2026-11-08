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
  Acting,
  AlertIntent,
} from '@shared/components/intents';
import { SecurityLock, InteractiveSurface, Prop } from '@shared/components/environment';
import { BlocksMovement } from '@shared/components/blocks-movement';
import { Attack } from '@shared/components/attack';
import { StatusEffects } from '@shared/components/status-effects';
import { Dying } from '@shared/components/dying';
import { Item } from '@shared/components/item';
import { CurrencyItem } from '@shared/components/currency-item';
import { AnchorMarker } from '@shared/components/anchor-marker';
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

  describe('(6) Dijkstra Passability & Dynamic Blocking', () => {
    it('standard enemies route around static blocking props rather than walking into them', () => {
      setupPlayer(6, 5);

      // Enemy at (3, 5) with basic approach tree (canCrushProps: false)
      const enemy = world.createEntity();
      world.addComponent(enemy, Position, { x: 3, y: 5 });
      world.addComponent(enemy, AIState, {
        behavior: AIBehavior.IDLE,
        behaviorType: AIBehaviorType.BASIC,
        treeId: 'basic',
        sightRadius: 20,
      });
      world.addComponent(enemy, FovAwareness, { canSeePlayer: true });
      grid.addEntity(enemy, 3, 5);

      // Static blocking prop at (4, 5) directly between enemy and player
      const prop = world.createEntity();
      world.addComponent(prop, Position, { x: 4, y: 5 });
      world.addComponent(prop, Prop, { propId: 'safe_01', faction: 'system', propClass: 'encrypted_safe', isSearched: false });
      world.addComponent(prop, BlocksMovement, {});
      grid.addEntity(prop, 4, 5);

      aiSystem.processEnemyTurn(enemy);

      // Enemy should NOT emit MoveIntent onto (4, 5) (the prop tile)
      const move = world.getComponent(enemy, MoveIntent);
      expect(move).toBeDefined();
      const targetX = 3 + move!.dx;
      const targetY = 5 + move!.dy;
      expect(`${targetX},${targetY}`).not.toBe('4,5');
      // Should have routed around, e.g. (3, 4) or (3, 6)
      expect([
        { dx: 0, dy: -1 },
        { dx: 0, dy: 1 },
      ]).toContainEqual({ dx: move!.dx, dy: move!.dy });
    });

    it('standard enemies route around locked SecurityLock doors', () => {
      setupPlayer(7, 5);

      // Enemy at (3, 5)
      const enemy = world.createEntity();
      world.addComponent(enemy, Position, { x: 3, y: 5 });
      world.addComponent(enemy, AIState, {
        behavior: AIBehavior.IDLE,
        behaviorType: AIBehaviorType.BASIC,
        treeId: 'basic',
        sightRadius: 20,
      });
      world.addComponent(enemy, FovAwareness, { canSeePlayer: true });
      grid.addEntity(enemy, 3, 5);

      // Locked door at (4, 5)
      const door = world.createEntity();
      world.addComponent(door, Position, { x: 4, y: 5 });
      world.addComponent(door, Prop, { propId: 'door_01', faction: 'system', propClass: 'vault_door', isSearched: false });
      world.addComponent(door, SecurityLock, { isLocked: true, keyIdRequired: 'vault_key' });
      world.addComponent(door, BlocksMovement, {});
      grid.addEntity(door, 4, 5);

      aiSystem.processEnemyTurn(enemy);

      const move = world.getComponent(enemy, MoveIntent);
      expect(move).toBeDefined();
      const targetX = 3 + move!.dx;
      const targetY = 5 + move!.dy;
      expect(`${targetX},${targetY}`).not.toBe('4,5');
    });

    it('standard enemies step around allies occupying direct downhill step when alternate path exists', () => {
      setupPlayer(5, 6);

      // Enemy at (3, 5)
      const enemy = world.createEntity();
      world.addComponent(enemy, Position, { x: 3, y: 5 });
      world.addComponent(enemy, AIState, {
        behavior: AIBehavior.IDLE,
        behaviorType: AIBehaviorType.BASIC,
        treeId: 'basic',
        sightRadius: 20,
      });
      world.addComponent(enemy, FovAwareness, { canSeePlayer: true });
      grid.addEntity(enemy, 3, 5);

      // Ally enemy at (4, 5) (downhill step)
      const ally = world.createEntity();
      world.addComponent(ally, Position, { x: 4, y: 5 });
      world.addComponent(ally, BlocksMovement, {});
      grid.addEntity(ally, 4, 5);

      aiSystem.processEnemyTurn(enemy);

      const move = world.getComponent(enemy, MoveIntent);
      expect(move).toBeDefined();
      const targetX = 3 + move!.dx;
      const targetY = 5 + move!.dy;
      // Enemy should step around ally to (3, 6) rather than bumping into (4, 5)
      expect(`${targetX},${targetY}`).toBe('3,6');
      expect(move).toEqual({ dx: 0, dy: 1 });
    });

    it('standard enemies do not step into allies when no alternate downhill step exists', () => {
      setupPlayer(6, 5);

      // Enemy at (3, 5)
      const enemy = world.createEntity();
      world.addComponent(enemy, Position, { x: 3, y: 5 });
      world.addComponent(enemy, AIState, {
        behavior: AIBehavior.IDLE,
        behaviorType: AIBehaviorType.BASIC,
        treeId: 'basic',
        sightRadius: 20,
      });
      world.addComponent(enemy, FovAwareness, { canSeePlayer: true });
      grid.addEntity(enemy, 3, 5);

      // Ally enemy at (4, 5) (downhill step)
      const ally = world.createEntity();
      world.addComponent(ally, Position, { x: 4, y: 5 });
      world.addComponent(ally, BlocksMovement, {});
      grid.addEntity(ally, 4, 5);

      aiSystem.processEnemyTurn(enemy);

      // Should NOT emit MoveIntent onto (4, 5)
      const move = world.getComponent(enemy, MoveIntent);
      expect(move).toBeUndefined();
    });
  });

  describe('(7) Multi-Enemy Sequential Turn Loop Alert & Pack State', () => {
    it('preserves AlertIntent across sequential enemy action sequences in the same turn', () => {
      // Player at (5, 5)
      setupPlayer(5, 5);

      // Enemy 1 at (1, 5) without LOS to player (wall in between)
      const enemy1 = world.createEntity();
      world.addComponent(enemy1, Position, { x: 1, y: 5 });
      world.addComponent(enemy1, AIState, {
        behavior: AIBehavior.IDLE,
        behaviorType: AIBehaviorType.BASIC,
        treeId: 'basic',
        sightRadius: 6,
      });
      world.addComponent(enemy1, FovAwareness, { canSeePlayer: false });
      grid.addEntity(enemy1, 1, 5);

      // Enemy 2 at (1, 6) without LOS to player
      const enemy2 = world.createEntity();
      world.addComponent(enemy2, Position, { x: 1, y: 6 });
      world.addComponent(enemy2, AIState, {
        behavior: AIBehavior.IDLE,
        behaviorType: AIBehaviorType.BASIC,
        treeId: 'basic',
        sightRadius: 6,
      });
      world.addComponent(enemy2, FovAwareness, { canSeePlayer: false });
      grid.addEntity(enemy2, 1, 6);

      // Block LOS with walls at x=2
      grid.setTile(2, 4, { walkable: false, transparent: false, terrain: 'wall' });
      grid.setTile(2, 5, { walkable: false, transparent: false, terrain: 'wall' });
      grid.setTile(2, 6, { walkable: false, transparent: false, terrain: 'wall' });
      grid.setTile(2, 7, { walkable: false, transparent: false, terrain: 'wall' });

      // Acoustic alert attaches AlertIntent to both enemies
      world.addComponent(enemy1, AlertIntent, { sourceX: 5, sourceY: 5 });
      world.addComponent(enemy2, AlertIntent, { sourceX: 5, sourceY: 5 });

      // TurnManager sequential execution:
      // Pass 1: Enemy 1 is Acting
      world.addComponent(enemy1, Acting, {});
      aiSystem.update(world);
      world.removeComponent(enemy1, Acting);

      // Enemy 1 consumed its alert and emitted MoveIntent
      expect(world.hasComponent(enemy1, AlertIntent)).toBe(false);
      expect(world.hasComponent(enemy1, MoveIntent)).toBe(true);

      // Enemy 2 retains its alerted state before its pass
      const enemy2Fov = world.getComponent(enemy2, FovAwareness)!;
      expect(enemy2Fov.canSeePlayer).toBe(true);
      expect(enemy2Fov.lastKnownPlayerX).toBe(5);
      expect(enemy2Fov.lastKnownPlayerY).toBe(5);

      // Pass 2: Enemy 2 is Acting
      world.addComponent(enemy2, Acting, {});
      aiSystem.update(world);
      world.removeComponent(enemy2, Acting);

      // Enemy 2 consumed its alert and emitted MoveIntent
      expect(world.hasComponent(enemy2, AlertIntent)).toBe(false);
      expect(world.hasComponent(enemy2, MoveIntent)).toBe(true);
    });

    it('propagates pack alerts across sequential enemy turn passes', () => {
      setupPlayer(5, 5);

      // Enemy 1 has LOS to player and is in pack "alpha"
      const enemy1 = world.createEntity();
      world.addComponent(enemy1, Position, { x: 3, y: 5 });
      world.addComponent(enemy1, AIState, {
        behavior: AIBehavior.IDLE,
        behaviorType: AIBehaviorType.BUFFER_OVERFLOW,
        treeId: 'buffer-overflow',
        sightRadius: 10,
      });
      world.addComponent(enemy1, FovAwareness, { canSeePlayer: true });
      world.addComponent(enemy1, PackMember, { packId: 'alpha', isLeader: true });
      grid.addEntity(enemy1, 3, 5);

      // Enemy 2 has NO LOS (behind wall) but is also in pack "alpha"
      const enemy2 = world.createEntity();
      world.addComponent(enemy2, Position, { x: 1, y: 1 });
      world.addComponent(enemy2, AIState, {
        behavior: AIBehavior.IDLE,
        behaviorType: AIBehaviorType.BUFFER_OVERFLOW,
        treeId: 'buffer-overflow',
        sightRadius: 10,
      });
      world.addComponent(enemy2, FovAwareness, { canSeePlayer: false });
      world.addComponent(enemy2, PackMember, { packId: 'alpha', isLeader: false });
      grid.addEntity(enemy2, 1, 1);

      // Pass 1: Enemy 1 acts
      world.addComponent(enemy1, Acting, {});
      aiSystem.update(world);
      world.removeComponent(enemy1, Acting);

      expect(world.hasComponent(enemy1, MoveIntent)).toBe(true);

      // Pass 2: Enemy 2 acts sequentially in same turn
      world.addComponent(enemy2, Acting, {});
      aiSystem.update(world);
      world.removeComponent(enemy2, Acting);

      // Enemy 2 joins pack swarm because Enemy 1 alerted the pack
      expect(world.hasComponent(enemy2, MoveIntent)).toBe(true);
      const enemy2AI = world.getComponent(enemy2, AIState);
      expect(enemy2AI?.behavior).toBe(AIBehavior.CHASING);
    });
  });

  describe('(11) Logic-Leaker Cover Kiting, Schema Actions & Considerations (BT-REV-04)', () => {
    it('Logic-Leaker fires ranged attack without moving when already behind cover at range 3..5', () => {
      setupPlayer(10, 10);

      // Place a cover crate at (10, 8)
      const crate = world.createEntity();
      world.addComponent(crate, Position, { x: 10, y: 8 });
      world.addComponent(crate, InteractiveSurface, {
        surfaceId: 'cover_crate_1',
        providesCover: true,
        destructible: true,
      });
      world.addComponent(crate, BlocksMovement, {});
      grid.addEntity(crate, 10, 8);

      // Place Logic-Leaker at (10, 7) (dist = 3, behind cover at 10, 8)
      const leaker = world.createEntity();
      world.addComponent(leaker, Position, { x: 10, y: 7 });
      world.addComponent(leaker, AIState, {
        behavior: AIBehavior.IDLE,
        behaviorType: AIBehaviorType.LOGIC_LEAKER,
        treeId: 'logic-leaker',
        sightRadius: 10,
      });
      world.addComponent(leaker, FovAwareness, { canSeePlayer: true });
      world.addComponent(leaker, Acting, {});
      grid.addEntity(leaker, 10, 7);

      aiSystem.update(world);

      // Should fire corrupted packet, NOT emit MoveIntent
      expect(world.hasComponent(leaker, MoveIntent)).toBe(false);
      expect(world.hasComponent(leaker, ApplyStatusEffectIntent)).toBe(true);
      const effectIntent = world.getComponent(leaker, ApplyStatusEffectIntent);
      expect(effectIntent?.effect.name).toBe('FIRMWARE_LOCK');
    });

    it('Logic-Leaker repositions towards cover when exposed at range 3..5', () => {
      setupPlayer(10, 10);

      // Place a cover crate at (10, 8)
      const crate = world.createEntity();
      world.addComponent(crate, Position, { x: 10, y: 8 });
      world.addComponent(crate, InteractiveSurface, {
        surfaceId: 'cover_crate_2',
        providesCover: true,
        destructible: true,
      });
      world.addComponent(crate, BlocksMovement, {});
      grid.addEntity(crate, 10, 8);

      // Place Logic-Leaker at (12, 8) (dist = 4, cover at 10, 8)
      const leaker = world.createEntity();
      world.addComponent(leaker, Position, { x: 12, y: 8 });
      world.addComponent(leaker, AIState, {
        behavior: AIBehavior.IDLE,
        behaviorType: AIBehaviorType.LOGIC_LEAKER,
        treeId: 'logic-leaker',
        sightRadius: 10,
      });
      world.addComponent(leaker, FovAwareness, { canSeePlayer: true });
      world.addComponent(leaker, Acting, {});
      grid.addEntity(leaker, 12, 8);

      aiSystem.update(world);

      // Since leaker is exposed and tile with cover exists at distance 3..5, leaker should move towards cover
      expect(world.hasComponent(leaker, MoveIntent)).toBe(true);
      const move = world.getComponent(leaker, MoveIntent);
      expect(move?.dx).toBeLessThan(0);
    });

    it('SPAWN_ENTITIES_AROUND_SELF clamps to action.count when specified', () => {
      setupPlayer(0, 0);
      const spawner = world.createEntity();
      world.addComponent(spawner, Position, { x: 5, y: 5 });
      world.addComponent(spawner, AIState, {
        behavior: AIBehavior.IDLE,
        behaviorType: AIBehaviorType.FRAGMENTER,
        inlineTree: {
          type: 'ACTION',
          task: {
            action: 'SPAWN_ENTITIES_AROUND_SELF',
            templateName: 'dead-zone',
            pattern: 'cardinal_4',
            count: 2,
          },
        },
      });
      world.addComponent(spawner, FovAwareness, { canSeePlayer: false });
      world.addComponent(spawner, Acting, {});
      grid.addEntity(spawner, 5, 5);

      aiSystem.update(world);

      const spawnIntent = world.getComponent(spawner, SpawnEntityIntent);
      expect(spawnIntent).toBeDefined();
      expect(spawnIntent?.spawns.length).toBe(2);
    });

    it('evaluates nearby_loot_value consideration metric based on items and currency', () => {
      setupPlayer(0, 0);
      const enemy = world.createEntity();
      world.addComponent(enemy, Position, { x: 5, y: 5 });
      world.addComponent(enemy, AIState, {
        behavior: AIBehavior.IDLE,
        behaviorType: AIBehaviorType.BASIC,
        sightRadius: 6,
        inlineTree: {
          type: 'UTILITY_SELECTOR',
          branches: [
            {
              name: 'loot-branch',
              considerations: [
                {
                  metric: 'nearby_loot_value',
                  curve: 'linear',
                  slope: 1,
                  invert: false,
                  minInput: 0,
                  maxInput: 1,
                },
              ],
              child: {
                type: 'ACTION',
                task: {
                  action: 'WAIT',
                  message: 'Eyeing loot!',
                },
              },
            },
          ],
        },
      });
      world.addComponent(enemy, FovAwareness, { canSeePlayer: false });
      world.addComponent(enemy, Acting, {});
      grid.addEntity(enemy, 5, 5);

      // Add 2 items and 1 currency nearby
      const item1 = world.createEntity();
      world.addComponent(item1, Position, { x: 6, y: 5 });
      world.addComponent(item1, Item, { name: 'Health Pack' });

      const currency1 = world.createEntity();
      world.addComponent(currency1, Position, { x: 5, y: 6 });
      world.addComponent(currency1, CurrencyItem, { currencyType: 'scrap', amount: 20 });

      aiSystem.update(world);

      const enemyAI = world.getComponent(enemy, AIState);
      expect(enemyAI?.lastEvaluatedPath).toContain('WAIT [SUCCESS]');
    });

    it('supports scavenge_nearest_loot and patrol_anchors mapType in MOVE_DIJKSTRA', () => {
      setupPlayer(0, 0);
      const enemy = world.createEntity();
      world.addComponent(enemy, Position, { x: 2, y: 2 });
      world.addComponent(enemy, AIState, {
        behavior: AIBehavior.IDLE,
        behaviorType: AIBehaviorType.BASIC,
        inlineTree: {
          type: 'ACTION',
          task: {
            action: 'MOVE_DIJKSTRA',
            mapType: 'scavenge_nearest_loot',
            avoidHazards: true,
            canCrushProps: false,
          },
        },
      });
      world.addComponent(enemy, FovAwareness, { canSeePlayer: false });
      world.addComponent(enemy, Acting, {});
      grid.addEntity(enemy, 2, 2);

      // Place an item at (5, 2)
      const item = world.createEntity();
      world.addComponent(item, Position, { x: 5, y: 2 });
      world.addComponent(item, Item, { name: 'Processor Chip' });

      aiSystem.update(world);

      expect(world.hasComponent(enemy, MoveIntent)).toBe(true);
      const move = world.getComponent(enemy, MoveIntent);
      expect(move?.dx).toBe(1); // Steps towards (5, 2)
      expect(move?.dy).toBe(0);
    });
  });
});
