import { describe, it, expect, beforeEach, vi } from 'vitest';
import { World } from '@engine/ecs/world';
import { Grid } from '@engine/grid/grid';
import { EventBus } from '@engine/events/event-bus';
import { EntityFactory } from '@engine/entity/factory';
import { EntityRegistry } from '@engine/entity/registry';
import { ComponentRegistry } from '@engine/entity/types';
import { ComponentDef, Phase } from '@engine/ecs/types';
import { GameplayEvents } from '@shared/events/types';
import {
  COMPONENTS_REGISTRY,
  Actor,
  Position,
  Heat,
  Stability,
  FloorState,
  Hostile,
  FovAwareness,
  AIState,
  MoveIntent,
  TeleportIntent,
  BlocksMovement,
  RunInventory,
  RunCurrency,
  ActionAbortedTag,
  SpriteComponent,
} from '@shared/components';
import { logger } from '@engine/utils/logger';
import { AIBehavior, AIBehaviorType } from '@shared/components/ai-state';
import {
  Prop,
  SecurityLock,
  Container,
  CorruptedNode,
  InteractPropIntent,
} from '@shared/components/environment';
import { AlertIntent } from '@shared/components/intents';
import { createPropInteractionSystem, triggerAcousticAlert } from '../prop-interaction';
import { createMovementSystem } from '../movement';
import { createTeleportSystem } from '../teleport';
import { createAISystem } from '../ai';
import { createTagCleanupSystem } from '../tag-cleanup';
import { registerGameTemplates } from '../../entities';

describe('PropInteractionSystem & Bump-to-Loot Safeguards', () => {
  let world: World<GameplayEvents>;
  let grid: Grid;
  let eventBus: EventBus<GameplayEvents>;
  let entityFactory: EntityFactory;
  let componentRegistry: ComponentRegistry;
  let playerId: number;

  beforeEach(() => {
    eventBus = new EventBus<GameplayEvents>();
    world = new World<GameplayEvents>(eventBus);
    grid = new Grid(20, 20);

    const entityRegistry = new EntityRegistry();
    registerGameTemplates(entityRegistry);
    entityFactory = new EntityFactory(entityRegistry);

    const componentsMap: Record<string, ComponentDef<unknown>> = Object.fromEntries(
      COMPONENTS_REGISTRY.map((c) => [c.key, c]),
    );
    componentRegistry = {
      get: (key: string) => componentsMap[key],
      has: (key: string) => !!componentsMap[key],
    };

    // Spawn player at (5, 5)
    playerId = world.createEntity();
    world.addComponent(playerId, Actor, { isPlayer: true });
    world.addComponent(playerId, Position, { x: 5, y: 5 });
    world.addComponent(playerId, Heat, {
      current: 0,
      maxSafe: 100,
      baseDissipation: 5,
      ventPercentage: 0.5,
      isVenting: false,
    });
    world.addComponent(playerId, Stability, { current: 50, max: 100 });
    world.addComponent(playerId, FloorState, {
      currentFloor: 6,
      maxFloor: 15,
      runSeed: 'test-seed',
      accessKeysHeld: 0,
      vaultsBreached: 0,
    });
    world.addComponent(playerId, RunCurrency, { stacks: [] });
    world.addComponent(playerId, RunInventory, { maxSlots: 5, software: [], equipment: [] });
    grid.addEntity(playerId, 5, 5);
  });

  describe('Adjacency & Range Validation', () => {
    it('rejects interaction when Manhattan distance is greater than 1', () => {
      const propSystem = createPropInteractionSystem(world, grid, eventBus, entityFactory, componentRegistry);
      propSystem.init();
      const aiSystem = createAISystem(world, grid, eventBus, entityFactory, componentRegistry);
      aiSystem.init();

      const propId = world.createEntity();
      world.addComponent(propId, Position, { x: 10, y: 10 }); // Far away
      world.addComponent(propId, Prop, { propId: 'p1', faction: 'traxus', propClass: 'locker', isSearched: false });
      world.addComponent(propId, Container, { containerId: 'c1', scrapYield: 20 });
      grid.addEntity(propId, 10, 10);

      world.addComponent(playerId, InteractPropIntent, { targetPropId: propId, forceOverride: false });
      world.executeSystems(Phase.ACTION);

      const prop = world.getComponent(propId, Prop)!;
      expect(prop.isSearched).toBe(false); // Did not interact
    });
  });

  describe('Two-Tier Bump-to-Loot Safeguards (MovementSystem)', () => {
    it('safely converts MoveIntent to InteractPropIntent when bumping a clean container', () => {
      const moveSystem = createMovementSystem(world, grid, eventBus);
      moveSystem.init();

      // Place clean container at (6, 5)
      const propId = world.createEntity();
      world.addComponent(propId, Position, { x: 6, y: 5 });
      world.addComponent(propId, Prop, { propId: 'locker1', faction: 'traxus', propClass: 'locker', isSearched: false });
      world.addComponent(propId, Container, { containerId: 'c1', scrapYield: 15 });
      world.addComponent(propId, BlocksMovement, {});
      grid.addEntity(propId, 6, 5);

      // Player attempts to walk east into the locker
      world.addComponent(playerId, MoveIntent, { dx: 1, dy: 0 });
      world.executeSystems(Phase.ACTION);
      eventBus.flush();

      // Movement should be blocked, player position unchanged
      const playerPos = world.getComponent(playerId, Position)!;
      expect(playerPos.x).toBe(5);
      expect(playerPos.y).toBe(5);

      // MoveIntent converted to InteractPropIntent
      expect(world.hasComponent(playerId, MoveIntent)).toBe(false);
      expect(world.hasComponent(playerId, InteractPropIntent)).toBe(true);
      const intent = world.getComponent(playerId, InteractPropIntent)!;
      expect(intent.targetPropId).toBe(propId);
    });

    it('halts bump movement with warning and 0 turn cost when bumping a revealed armed CorruptedNode', () => {
      const moveSystem = createMovementSystem(world, grid, eventBus);
      moveSystem.init();

      const messageSpy = vi.fn();
      const bufferSpy = vi.fn();
      eventBus.on('MESSAGE_EMITTED', messageSpy);
      eventBus.on('INPUT_BUFFER_CLEARED', bufferSpy);

      // Place revealed corrupted terminal at (6, 5)
      const propId = world.createEntity();
      world.addComponent(propId, Position, { x: 6, y: 5 });
      world.addComponent(propId, Prop, { propId: 'ws1', faction: 'cyberacme', propClass: 'workstation', isSearched: false });
      world.addComponent(propId, CorruptedNode, { trapType: 'acoustic_alert', corruptionLevel: 2, isDisarmed: false, triggered: false, revealed: true });
      world.addComponent(propId, BlocksMovement, {});
      grid.addEntity(propId, 6, 5);

      world.addComponent(playerId, MoveIntent, { dx: 1, dy: 0 });
      world.executeSystems(Phase.ACTION);
      eventBus.flush();

      // Move cancelled, NO InteractPropIntent added (Tier 2 Safeguard)
      expect(world.hasComponent(playerId, MoveIntent)).toBe(false);
      expect(world.hasComponent(playerId, InteractPropIntent)).toBe(false);
      expect(world.hasComponent(playerId, ActionAbortedTag)).toBe(true);
      expect(bufferSpy).toHaveBeenCalled();

      expect(messageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'warning',
          text: expect.stringContaining('Corrupted terminal detected'),
        }),
      );
    });

    it('converts MoveIntent to InteractPropIntent and triggers trap when bumping an unrevealed CorruptedNode', () => {
      const moveSystem = createMovementSystem(world, grid, eventBus);
      moveSystem.init();
      const propSystem = createPropInteractionSystem(world, grid, eventBus, entityFactory, componentRegistry);
      propSystem.init();

      const propId = world.createEntity();
      world.addComponent(propId, Position, { x: 6, y: 5 });
      world.addComponent(propId, Prop, { propId: 'ws_unrevealed', faction: 'cyberacme', propClass: 'workstation', isSearched: false });
      world.addComponent(propId, Container, { containerId: 'ws_unrevealed', capacity: 4, scrapYield: 10, itemEntityIds: [] });
      world.addComponent(propId, CorruptedNode, { trapType: 'hud_glitch', corruptionLevel: 2, isDisarmed: false, triggered: false, revealed: false });
      world.addComponent(propId, BlocksMovement, {});
      grid.addEntity(propId, 6, 5);

      world.addComponent(playerId, MoveIntent, { dx: 1, dy: 0 });
      world.executeSystems(Phase.ACTION);
      eventBus.flush();

      const corrupted = world.getComponent(propId, CorruptedNode)!;
      expect(corrupted.triggered).toBe(true);
      expect(corrupted.revealed).toBe(true);
      expect(world.getComponent(propId, Prop)!.isSearched).toBe(true);
    });

    it('halts bump movement with warning when bumping a SecurityLock without an Access Key', () => {
      const moveSystem = createMovementSystem(world, grid, eventBus);
      moveSystem.init();

      const messageSpy = vi.fn();
      const bufferSpy = vi.fn();
      eventBus.on('MESSAGE_EMITTED', messageSpy);
      eventBus.on('INPUT_BUFFER_CLEARED', bufferSpy);

      const propId = world.createEntity();
      world.addComponent(propId, Position, { x: 6, y: 5 });
      world.addComponent(propId, Prop, { propId: 'door1', faction: 'traxus', propClass: 'vault_door', isSearched: false });
      world.addComponent(propId, SecurityLock, { isLocked: true, overclockHeatCost: 35 });
      world.addComponent(propId, BlocksMovement, {});
      grid.addEntity(propId, 6, 5);

      world.addComponent(playerId, MoveIntent, { dx: 1, dy: 0 });
      world.executeSystems(Phase.ACTION);
      eventBus.flush();

      expect(world.hasComponent(playerId, MoveIntent)).toBe(false);
      expect(world.hasComponent(playerId, InteractPropIntent)).toBe(false);
      expect(world.hasComponent(playerId, ActionAbortedTag)).toBe(true);
      expect(bufferSpy).toHaveBeenCalled();

      expect(messageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'warning',
          text: expect.stringContaining('Overclocking blast lock costs +35 Heat'),
        }),
      );
    });
  });

  describe('SecurityLock & Overclock Bypass', () => {
    it('unlocks with keycard without increasing heat when player holds an Access Key', () => {
      const propSystem = createPropInteractionSystem(world, grid, eventBus, entityFactory, componentRegistry);
      propSystem.init();
      const aiSystem = createAISystem(world, grid, eventBus, entityFactory, componentRegistry);
      aiSystem.init();

      const unlockSpy = vi.fn();
      eventBus.on('LOCK_UNLOCKED', unlockSpy);

      // Give player 1 key
      world.patchComponent(playerId, FloorState, { accessKeysHeld: 1 });

      const doorId = world.createEntity();
      world.addComponent(doorId, Position, { x: 6, y: 5 });
      world.addComponent(doorId, Prop, { propId: 'vault_door', faction: 'traxus', propClass: 'vault_door', isSearched: false });
      world.addComponent(doorId, SecurityLock, { isLocked: true, overclockHeatCost: 35 });
      world.addComponent(doorId, BlocksMovement, {});
      grid.addEntity(doorId, 6, 5);

      world.addComponent(playerId, InteractPropIntent, { targetPropId: doorId, forceOverride: false });
      world.executeSystems(Phase.ACTION);
      eventBus.flush();

      const lock = world.getComponent(doorId, SecurityLock)!;
      expect(lock.isLocked).toBe(false);
      expect(world.hasComponent(doorId, BlocksMovement)).toBe(false); // Blast door opened

      // Player key consumed
      const floorState = world.getComponent(playerId, FloorState)!;
      expect(floorState.accessKeysHeld).toBe(0);

      // Player heat unchanged
      const heat = world.getComponent(playerId, Heat)!;
      expect(heat.current).toBe(0);

      expect(unlockSpy).toHaveBeenCalledWith(
        expect.objectContaining({ method: 'key' }),
      );
    });

    it('performs Overclock bypass with +35 Heat, acoustic alert, and score update when forceOverride is true', () => {
      const propSystem = createPropInteractionSystem(world, grid, eventBus, entityFactory, componentRegistry);
      propSystem.init();
      const aiSystem = createAISystem(world, grid, eventBus, entityFactory, componentRegistry);
      aiSystem.init();

      const unlockSpy = vi.fn();
      eventBus.on('LOCK_UNLOCKED', unlockSpy);

      // Spawn an enemy 5 tiles away
      const enemyId = world.createEntity();
      world.addComponent(enemyId, Hostile, {});
      world.addComponent(enemyId, Position, { x: 10, y: 5 });
      world.addComponent(enemyId, FovAwareness, { canSeePlayer: false });
      world.addComponent(enemyId, AIState, {
        behavior: AIBehavior.IDLE,
        behaviorType: AIBehaviorType.BASIC,
        sightRadius: 6,
      });
      grid.addEntity(enemyId, 10, 5);

      const doorId = world.createEntity();
      world.addComponent(doorId, Position, { x: 6, y: 5 });
      world.addComponent(doorId, Prop, { propId: 'vault_door', faction: 'traxus', propClass: 'vault_door', isSearched: false });
      world.addComponent(doorId, SecurityLock, { isLocked: true, overclockHeatCost: 35, alertRadiusOnBypass: 12 });
      world.addComponent(doorId, BlocksMovement, {});
      grid.addEntity(doorId, 6, 5);

      const tagCleanup = createTagCleanupSystem(world);
      tagCleanup.init();

      // Player force overrides without key
      world.addComponent(playerId, InteractPropIntent, { targetPropId: doorId, forceOverride: true });
      world.executeSystems(Phase.ACTION);
      world.executeSystems(Phase.CLEANUP);
      world.executeSystems(Phase.GATHER_INTENT);
      eventBus.flush();

      const lock = world.getComponent(doorId, SecurityLock)!;
      expect(lock.isLocked).toBe(false);

      // Player heat increased by 35
      const heat = world.getComponent(playerId, Heat)!;
      expect(heat.current).toBe(35);

      // Vault breached score incremented
      const floorState = world.getComponent(playerId, FloorState)!;
      expect(floorState.vaultsBreached).toBe(1);

      // Acoustic alert alerted enemy
      const enemyFov = world.getComponent(enemyId, FovAwareness)!;
      const enemyAi = world.getComponent(enemyId, AIState)!;
      expect(enemyFov.canSeePlayer).toBe(true);
      expect(enemyAi.behavior).toBe(AIBehavior.CHASING);

      expect(unlockSpy).toHaveBeenCalledWith(
        expect.objectContaining({ method: 'overclock' }),
      );
    });

    it('rejects Overclock bypass if Heat + 35 > 100', () => {
      const propSystem = createPropInteractionSystem(world, grid, eventBus, entityFactory, componentRegistry);
      propSystem.init();
      const aiSystem = createAISystem(world, grid, eventBus, entityFactory, componentRegistry);
      aiSystem.init();

      // Player already at 75 Heat (75 + 35 = 110 > 100)
      world.patchComponent(playerId, Heat, { current: 75 });

      const doorId = world.createEntity();
      world.addComponent(doorId, Position, { x: 6, y: 5 });
      world.addComponent(doorId, Prop, { propId: 'vault_door', faction: 'traxus', propClass: 'vault_door', isSearched: false });
      world.addComponent(doorId, SecurityLock, { isLocked: true, overclockHeatCost: 35 });
      world.addComponent(doorId, BlocksMovement, {});
      grid.addEntity(doorId, 6, 5);

      world.addComponent(playerId, InteractPropIntent, { targetPropId: doorId, forceOverride: true });
      world.executeSystems(Phase.ACTION);
      eventBus.flush();

      // Door remains locked
      const lock = world.getComponent(doorId, SecurityLock)!;
      expect(lock.isLocked).toBe(true);
      const heat = world.getComponent(playerId, Heat)!;
      expect(heat.current).toBe(75); // Heat unchanged
    });
  });

  describe('Faraday Shielding (TeleportSystem)', () => {
    it('blocks Phase-Shift teleportation into locked Faraday bounds', () => {
      const teleportSystem = createTeleportSystem(world, grid, eventBus);
      teleportSystem.init();

      const messageSpy = vi.fn();
      eventBus.on('MESSAGE_EMITTED', messageSpy);

      // Locked Zero-Day Vault blast door guarding bounds (10, 10, width: 8, height: 6)
      const doorId = world.createEntity();
      world.addComponent(doorId, Position, { x: 9, y: 12 });
      world.addComponent(doorId, SecurityLock, {
        isLocked: true,
        faradayBounds: { x: 10, y: 10, width: 8, height: 6 },
      });

      // Player attempts to teleport to (12, 12) inside the vault
      world.addComponent(playerId, TeleportIntent, { x: 12, y: 12 });
      world.executeSystems(Phase.ACTION);
      eventBus.flush();

      // Player position unchanged
      const playerPos = world.getComponent(playerId, Position)!;
      expect(playerPos.x).toBe(5);
      expect(playerPos.y).toBe(5);

      expect(messageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
          text: expect.stringContaining('FARADAY SHIELD'),
        }),
      );
    });
  });

  describe('Tactical Terminals', () => {
    it('restores +10 Stability when activating Reality Stabilizer', () => {
      const propSystem = createPropInteractionSystem(world, grid, eventBus, entityFactory, componentRegistry);
      propSystem.init();
      const aiSystem = createAISystem(world, grid, eventBus, entityFactory, componentRegistry);
      aiSystem.init();

      const stabId = world.createEntity();
      world.addComponent(stabId, Position, { x: 6, y: 5 });
      world.addComponent(stabId, Prop, { propId: 'stab1', faction: 'sekiguchi', propClass: 'reality_stabilizer', isSearched: false, stabilityRestoreAmount: 10 });
      grid.addEntity(stabId, 6, 5);

      world.addComponent(playerId, InteractPropIntent, { targetPropId: stabId, forceOverride: false });
      world.executeSystems(Phase.ACTION);

      const stab = world.getComponent(playerId, Stability)!;
      expect(stab.current).toBe(60); // 50 + 10 = 60
      const prop = world.getComponent(stabId, Prop)!;
      expect(prop.isSearched).toBe(true);
    });

    it('purges 40 Heat when activating Thermal Cooling Vent', () => {
      const propSystem = createPropInteractionSystem(world, grid, eventBus, entityFactory, componentRegistry);
      propSystem.init();
      const aiSystem = createAISystem(world, grid, eventBus, entityFactory, componentRegistry);
      aiSystem.init();

      world.patchComponent(playerId, Heat, { current: 60 });

      const ventId = world.createEntity();
      world.addComponent(ventId, Position, { x: 6, y: 5 });
      world.addComponent(ventId, Prop, { propId: 'vent1', faction: 'nucaloric', propClass: 'cooling_vent', isSearched: false, ventAmount: 40 });
      grid.addEntity(ventId, 6, 5);

      world.addComponent(playerId, InteractPropIntent, { targetPropId: ventId, forceOverride: false });
      world.executeSystems(Phase.ACTION);

      const heat = world.getComponent(playerId, Heat)!;
      expect(heat.current).toBe(20); // 60 - 40 = 20
      const prop = world.getComponent(ventId, Prop)!;
      expect(prop.isSearched).toBe(true);
    });

    it('transmits item to Profile Vault via Teleport Dead-Drop Uplink costing 25 Flux', () => {
      const propSystem = createPropInteractionSystem(world, grid, eventBus, entityFactory, componentRegistry);
      propSystem.init();
      const aiSystem = createAISystem(world, grid, eventBus, entityFactory, componentRegistry);
      aiSystem.init();

      const deadDropSpy = vi.fn();
      eventBus.on('DEAD_DROP_TRANSMITTED', deadDropSpy);

      // Give player 30 Flux and 1 software item
      world.patchComponent(playerId, RunCurrency, {
        stacks: [{ currencyType: 'flux', amount: 30 }],
      });
      world.patchComponent(playerId, RunInventory, {
        maxSlots: 5,
        software: [
          {
            entityId: 101,
            templateId: 'phase-shift',
            rarityTier: 'rare',
            pickedUpAtFloor: 6,
            pickedUpAtTimestamp: 1000,
          },
        ],
        equipment: [],
      });

      const uplinkId = world.createEntity();
      world.addComponent(uplinkId, Position, { x: 6, y: 5 });
      world.addComponent(uplinkId, Prop, { propId: 'uplink1', faction: 'cyberacme', propClass: 'dead_drop_uplink', isSearched: false, deadDropFluxCost: 25 });
      grid.addEntity(uplinkId, 6, 5);

      world.addComponent(playerId, InteractPropIntent, {
        targetPropId: uplinkId,
        forceOverride: false,
        deadDropSelectionId: 101,
      });
      world.executeSystems(Phase.ACTION);
      eventBus.flush();

      // Flux deducted (30 - 25 = 5)
      const currency = world.getComponent(playerId, RunCurrency)!;
      expect(currency.stacks.find((s) => s.currencyType === 'flux')?.amount).toBe(5);

      // Item removed from inventory
      const inv = world.getComponent(playerId, RunInventory)!;
      expect(inv.software.length).toBe(0);

      expect(deadDropSpy).toHaveBeenCalledWith(
        expect.objectContaining({ entityId: playerId, itemEntityId: 101 }),
      );
    });
  });

  describe('Container Loot Materialization & Forensics Audio Logs', () => {
    it('materializes stored loot items and emits corporate forensics audio log on search', () => {
      const propSystem = createPropInteractionSystem(world, grid, eventBus, entityFactory, componentRegistry);
      propSystem.init();
      const aiSystem = createAISystem(world, grid, eventBus, entityFactory, componentRegistry);
      aiSystem.init();

      const messageSpy = vi.fn();
      eventBus.on('MESSAGE_EMITTED', messageSpy);

      const safeId = world.createEntity();
      world.addComponent(safeId, Position, { x: 6, y: 5 });
      world.addComponent(safeId, Prop, { propId: 'safe1', faction: 'cyberacme', propClass: 'encrypted_safe', isSearched: false });
      world.addComponent(safeId, Container, {
        containerId: 'c_safe',
        scrapYield: 25,
        fluxYield: 10,
        grantsAccessKey: true,
        storedLoot: [{ templateId: 'neural-spike', rarityTier: 'uncommon' }],
        itemEntityIds: [],
      });
      grid.addEntity(safeId, 6, 5);

      world.addComponent(playerId, InteractPropIntent, { targetPropId: safeId, forceOverride: false });
      world.executeSystems(Phase.ACTION);
      eventBus.flush();

      const prop = world.getComponent(safeId, Prop)!;
      expect(prop.isSearched).toBe(true);

      const container = world.getComponent(safeId, Container)!;
      expect(container.storedLoot).toEqual([]);
      expect(container.itemEntityIds).toEqual([]);

      // Loot transferred directly to player backpack
      const inv = world.getComponent(playerId, RunInventory)!;
      expect(inv.software.length + inv.equipment.length).toBe(1);

      // Player received currency & access key
      const currency = world.getComponent(playerId, RunCurrency)!;
      expect(currency.stacks.find((s) => s.currencyType === 'scrap')?.amount).toBe(25);
      expect(currency.stacks.find((s) => s.currencyType === 'flux')?.amount).toBe(10);
      const floorState = world.getComponent(playerId, FloorState)!;
      expect(floorState.accessKeysHeld).toBe(1);

      // Forensics log emitted (CyberAcme)
      expect(messageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'info',
          text: expect.stringContaining('CYBERACME'),
        }),
      );
    });

    it('logs error when container item template fails instantiation rather than swallowing silently', () => {
      const propSystem = createPropInteractionSystem(world, grid, eventBus, entityFactory, componentRegistry);
      propSystem.init();

      const errorSpy = vi.spyOn(logger, 'error');

      const crateId = world.createEntity();
      world.addComponent(crateId, Position, { x: 6, y: 5 });
      world.addComponent(crateId, Prop, { propId: 'crate1', faction: 'traxus', propClass: 'locker', isSearched: false });
      world.addComponent(crateId, Container, {
        containerId: 'c_crate',
        storedLoot: [{ templateId: 'non-existent-template-xyz', rarityTier: 'common' }],
        itemEntityIds: [],
      });
      grid.addEntity(crateId, 6, 5);

      world.addComponent(playerId, InteractPropIntent, { targetPropId: crateId, forceOverride: false });
      world.executeSystems(Phase.ACTION);

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Failed to instantiate container item template 'non-existent-template-xyz'"),
        'PROP_INTERACTION',
      );
    });

    it('attaches AlertIntent on acoustic alert which AISystem consumes in Phase.GATHER_INTENT', () => {
      const aiSystem = createAISystem(world, grid, eventBus, entityFactory, componentRegistry);
      aiSystem.init();

      const enemyId = world.createEntity();
      world.addComponent(enemyId, Position, { x: 10, y: 10 });
      world.addComponent(enemyId, Hostile, {});
      world.addComponent(enemyId, FovAwareness, {
        canSeePlayer: false,
        lastKnownPlayerX: 0,
        lastKnownPlayerY: 0,
      });
      world.addComponent(enemyId, AIState, {
        behavior: AIBehavior.IDLE,
        behaviorType: AIBehaviorType.BASIC,
        sightRadius: 6,
      });

      // Trigger acoustic alert from (10, 15) with radius 8 (distance 5 <= 8)
      triggerAcousticAlert(world, 10, 15, 8);

      // Verify AlertIntent was attached
      const alertIntent = world.getComponent(enemyId, AlertIntent);
      expect(alertIntent).toBeDefined();
      expect(alertIntent?.sourceX).toBe(10);
      expect(alertIntent?.sourceY).toBe(15);

      // Execute GATHER_INTENT where AISystem runs
      world.executeSystems(Phase.GATHER_INTENT);

      // Verify AISystem consumed the intent and updated FovAwareness and AIState
      expect(world.hasComponent(enemyId, AlertIntent)).toBe(false);
      const fov = world.getComponent(enemyId, FovAwareness)!;
      expect(fov.canSeePlayer).toBe(true);
      expect(fov.lastKnownPlayerX).toBe(10);
      expect(fov.lastKnownPlayerY).toBe(15);
      const ai = world.getComponent(enemyId, AIState)!;
      expect(ai.behavior).toBe(AIBehavior.CHASING);
    });

    it('preserves directional orientation on unlocking vault doors and searching directional containers (HIGH-03)', () => {
      const propSystem = createPropInteractionSystem(world, grid, eventBus, entityFactory, componentRegistry);
      propSystem.init();

      // 1. Directional Vault Door unlock
      const doorId = world.createEntity();
      world.addComponent(doorId, Position, { x: 5, y: 6 });
      world.addComponent(doorId, Prop, { propId: 'door1', faction: 'system', propClass: 'vault_door', isSearched: false });
      world.addComponent(doorId, SecurityLock, { isLocked: true });
      world.addComponent(doorId, BlocksMovement, {});
      world.addComponent(doorId, SpriteComponent, { key: 'vault_door_locked_e' });
      grid.addEntity(doorId, 5, 6);

      // Player unlocks door with key
      world.patchComponent(playerId, FloorState, { accessKeysHeld: 1 });
      world.addComponent(playerId, InteractPropIntent, {
        targetPropId: doorId,
        forceOverride: false,
      });

      world.executeSystems(Phase.ACTION);
      eventBus.flush();

      // Door should be unlocked, blocksMovement removed, orientation preserved as prop_vault_door_e
      expect(world.getComponent(doorId, SecurityLock)?.isLocked).toBe(false);
      expect(world.hasComponent(doorId, BlocksMovement)).toBe(false);
      expect(world.getComponent(doorId, SpriteComponent)?.key).toBe('prop_vault_door_e');

      // 2. Directional Locker search
      const lockerId = world.createEntity();
      world.addComponent(lockerId, Position, { x: 6, y: 5 });
      world.addComponent(lockerId, Prop, { propId: 'locker1', faction: 'system', propClass: 'locker', isSearched: false });
      world.addComponent(lockerId, Container, {
        containerId: 'c_locker',
        scrapYield: 10,
        fluxYield: 0,
        grantsAccessKey: false,
        storedLoot: [],
        itemEntityIds: [],
      });
      world.addComponent(lockerId, SpriteComponent, { key: 'prop_locker_s' });
      grid.addEntity(lockerId, 6, 5);

      world.addComponent(playerId, InteractPropIntent, {
        targetPropId: lockerId,
        forceOverride: false,
      });

      world.executeSystems(Phase.ACTION);
      eventBus.flush();

      expect(world.getComponent(lockerId, Prop)?.isSearched).toBe(true);
      // Directional key preserved!
      expect(world.getComponent(lockerId, SpriteComponent)?.key).toBe('prop_locker_s');

      // 3. Non-directional Locker search
      const baseLockerId = world.createEntity();
      world.addComponent(baseLockerId, Position, { x: 5, y: 4 });
      world.addComponent(baseLockerId, Prop, { propId: 'locker2', faction: 'system', propClass: 'locker', isSearched: false });
      world.addComponent(baseLockerId, Container, {
        containerId: 'c_locker2',
        scrapYield: 10,
        fluxYield: 0,
        grantsAccessKey: false,
        storedLoot: [],
        itemEntityIds: [],
      });
      world.addComponent(baseLockerId, SpriteComponent, { key: 'prop_locker_closed' });
      grid.addEntity(baseLockerId, 5, 4);

      world.addComponent(playerId, InteractPropIntent, {
        targetPropId: baseLockerId,
        forceOverride: false,
      });

      world.executeSystems(Phase.ACTION);
      eventBus.flush();

      expect(world.getComponent(baseLockerId, Prop)?.isSearched).toBe(true);
      // Non-directional template key updated to prop_locker
      expect(world.getComponent(baseLockerId, SpriteComponent)?.key).toBe('prop_locker');
    });
  });
});
