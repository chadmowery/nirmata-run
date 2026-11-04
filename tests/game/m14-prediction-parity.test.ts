import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '@engine/ecs/world';
import { Grid } from '@engine/grid/grid';
import { EventBus } from '@engine/events/event-bus';
import { TurnManager } from '@engine/turn/turn-manager';
import { GameTurnAdapter } from '../../src/game/turn/game-turn-adapter';
import { createMovementSystem } from '../../src/game/systems/movement';
import { createPropInteractionSystem } from '../../src/game/systems/prop-interaction';
import { createTagCleanupSystem } from '../../src/game/systems/tag-cleanup';
import { EntityFactory } from '@engine/entity/factory';
import { EntityRegistry } from '@engine/entity/registry';
import { ComponentRegistry } from '@engine/entity/types';
import { ComponentDef, Phase } from '@engine/ecs/types';
import {
  COMPONENTS_REGISTRY,
  Actor,
  Position,
  Energy,
  Health,
  FloorState,
  Hostile,
  MoveIntent,
  RunInventory,
  RunCurrency,
  Prop,
  Container,
  SecurityLock,
  CorruptedNode,
  InteractPropIntent,
  ActionAbortedTag,
} from '@shared/components';
import { GameplayEvents } from '@shared/events/types';
import { createECSWorldDelta } from '@shared/ecs-delta';
import { registerGameTemplates } from '../../src/game/entities';

describe('M14: Client-Side Prediction Parity for New Environmental Systems', () => {
  let serverWorld: World<GameplayEvents>;
  let serverGrid: Grid;
  let serverBus: EventBus<GameplayEvents>;
  let serverTurnManager: TurnManager<GameplayEvents>;

  let clientWorld: World<GameplayEvents>;
  let clientGrid: Grid;
  let clientBus: EventBus<GameplayEvents>;
  let clientTurnManager: TurnManager<GameplayEvents>;

  let entityFactory: EntityFactory;
  let componentRegistry: ComponentRegistry;

  const WIDTH = 15;
  const HEIGHT = 15;

  beforeEach(() => {
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

    // 1. Setup Server Engine (isClient: false)
    serverBus = new EventBus<GameplayEvents>();
    serverWorld = new World<GameplayEvents>(serverBus);
    serverGrid = new Grid(WIDTH, HEIGHT);
    for (let y = 0; y < HEIGHT; y++) {
      for (let x = 0; x < WIDTH; x++) {
        serverGrid.setTile(x, y, { walkable: true });
      }
    }
    const serverAdapter = new GameTurnAdapter(serverWorld, { defaultActionCost: 1000 });
    serverTurnManager = new TurnManager(
      serverWorld,
      serverBus,
      { energyThreshold: 1000, defaultActionCost: 1000, waitActionCost: 500, isClient: false },
      serverAdapter,
    );
    createMovementSystem(serverWorld, serverGrid, serverBus, false).init();
    createPropInteractionSystem(serverWorld, serverGrid, serverBus, entityFactory, componentRegistry).init();
    createTagCleanupSystem(serverWorld).init();

    // 2. Setup Client Engine (isClient: true) - prediction safe only, no PropInteractionSystem
    clientBus = new EventBus<GameplayEvents>();
    clientWorld = new World<GameplayEvents>(clientBus);
    clientGrid = new Grid(WIDTH, HEIGHT);
    for (let y = 0; y < HEIGHT; y++) {
      for (let x = 0; x < WIDTH; x++) {
        clientGrid.setTile(x, y, { walkable: true });
      }
    }
    const clientAdapter = new GameTurnAdapter(clientWorld, { defaultActionCost: 1000 });
    clientTurnManager = new TurnManager(
      clientWorld,
      clientBus,
      { energyThreshold: 1000, defaultActionCost: 1000, waitActionCost: 500, isClient: true },
      clientAdapter,
    );
    createMovementSystem(clientWorld, clientGrid, clientBus, true).init();
    createTagCleanupSystem(clientWorld).init();

    // Wire action handlers
    serverTurnManager.setPlayerActionHandler((action, actorId) => {
      if (action === 'MOVE_EAST') {
        serverWorld.addComponent(actorId, MoveIntent, { dx: 1, dy: 0 });
      }
    });

    clientTurnManager.setPlayerActionHandler((action, actorId) => {
      if (action === 'MOVE_EAST') {
        clientWorld.addComponent(actorId, MoveIntent, { dx: 1, dy: 0 });
      }
    });
  });

  function setupPlayer(world: World<GameplayEvents>, grid: Grid, x = 5, y = 5): number {
    const id = world.createEntity();
    world.addComponent(id, Actor, { isPlayer: true });
    world.addComponent(id, Position, { x, y });
    world.addComponent(id, Energy, { current: 1000, speed: 100, threshold: 1000 });
    world.addComponent(id, Health, { current: 30, max: 30, isAlive: true });
    world.addComponent(id, FloorState, { currentFloor: 1, maxFloor: 15, runSeed: 'seed-parity' });
    world.addComponent(id, RunInventory, {
      maxSlots: 10,
      software: [],
      equipment: [],
    });
    world.addComponent(id, RunCurrency, {
      stacks: [
        { currencyType: 'scrap', amount: 0 },
        { currencyType: 'flux', amount: 0 },
      ],
    });
    grid.addEntity(id, x, y);
    return id;
  }

  it('maintains parity on unblocked movement prediction and delta reconciliation', () => {
    const serverPlayer = setupPlayer(serverWorld, serverGrid, 5, 5);
    const clientPlayer = setupPlayer(clientWorld, clientGrid, 5, 5);

    serverTurnManager.start();
    clientTurnManager.start();

    // Snapshot server before action
    const oldServerWorld = serverWorld.getSerializableState();

    // Client predicts movement
    clientTurnManager.submitAction('MOVE_EAST');
    const clientPos = clientWorld.getComponent(clientPlayer, Position)!;
    expect(clientPos).toEqual({ x: 6, y: 5 });

    // Server executes authoritative turn
    serverTurnManager.submitAction('MOVE_EAST');
    const serverPos = serverWorld.getComponent(serverPlayer, Position)!;
    expect(serverPos).toEqual({ x: 6, y: 5 });

    // Client reconciles authoritative delta
    const delta = createECSWorldDelta(oldServerWorld, serverWorld.getSerializableState(), {
      redactForClient: true,
    });
    clientWorld.applyDelta(delta);

    // Parity asserted
    expect(clientWorld.getComponent(clientPlayer, Position)).toEqual(
      serverWorld.getComponent(serverPlayer, Position),
    );
  });

  it('maintains parity on bump to unsearched container (client halts without orphaned intent; server searches and syncs)', () => {
    const serverPlayer = setupPlayer(serverWorld, serverGrid, 5, 5);
    const clientPlayer = setupPlayer(clientWorld, clientGrid, 5, 5);

    // Place container at (6, 5) on both
    const createContainer = (w: World<GameplayEvents>, g: Grid) => {
      const id = w.createEntity();
      w.addComponent(id, Position, { x: 6, y: 5 });
      w.addComponent(id, Prop, { propId: 'crate-1', faction: 'traxus', propClass: 'locker', isSearched: false });
      w.addComponent(id, Container, {
        containerId: 'c1',
        scrapYield: 15,
        storedLoot: [],
        itemEntityIds: [],
        highestRarity: 'common',
      });
      g.addEntity(id, 6, 5);
      return id;
    };

    const serverContainer = createContainer(serverWorld, serverGrid);
    const clientContainer = createContainer(clientWorld, clientGrid);

    serverTurnManager.start();
    clientTurnManager.start();

    const oldServerWorld = serverWorld.getSerializableState();

    // Client predicts bump: movement blocked, no orphaned InteractPropIntent
    clientTurnManager.submitAction('MOVE_EAST');
    expect(clientWorld.getComponent(clientPlayer, Position)).toEqual({ x: 5, y: 5 });
    expect(clientWorld.hasComponent(clientPlayer, InteractPropIntent)).toBe(false);

    // Server executes turn: MovementSystem converts to InteractPropIntent, PropInteractionSystem searches
    serverTurnManager.submitAction('MOVE_EAST');
    expect(serverWorld.getComponent(serverPlayer, Position)).toEqual({ x: 5, y: 5 });
    expect(serverWorld.getComponent(serverContainer, Prop)!.isSearched).toBe(true);

    // Reconcile delta to client
    const delta = createECSWorldDelta(oldServerWorld, serverWorld.getSerializableState(), {
      redactForClient: true,
    });
    clientWorld.applyDelta(delta);

    // Parity assertions
    expect(clientWorld.getComponent(clientPlayer, Position)).toEqual({ x: 5, y: 5 });
    expect(clientWorld.getComponent(clientContainer, Prop)!.isSearched).toBe(true);
    // Currency updated on both
    const clientCurrencies = clientWorld.getComponent(clientPlayer, RunCurrency)!;
    expect(clientCurrencies.stacks.find((s) => s.currencyType === 'scrap')?.amount).toBe(15);
  });

  it('maintains parity on bump safeguard (armed CorruptedNode 0-cost halt and input queue flush)', () => {
    const serverPlayer = setupPlayer(serverWorld, serverGrid, 5, 5);
    const clientPlayer = setupPlayer(clientWorld, clientGrid, 5, 5);

    // Place revealed armed trap at (6, 5)
    const createTrap = (w: World<GameplayEvents>, g: Grid) => {
      const id = w.createEntity();
      w.addComponent(id, Position, { x: 6, y: 5 });
      w.addComponent(id, Prop, { propId: 'trap-1', faction: 'system', propClass: 'workstation', isSearched: false });
      w.addComponent(id, CorruptedNode, {
        isDisarmed: false,
        triggered: false,
        revealed: true,
        trapType: 'acoustic_alert',
      });
      g.addEntity(id, 6, 5);
      return id;
    };

    createTrap(serverWorld, serverGrid);
    createTrap(clientWorld, clientGrid);

    serverTurnManager.start();
    clientTurnManager.start();

    // Client predicts bump: halts, ActionAbortedTag triggers 0-cost reset, position remains at (5, 5)
    clientTurnManager.submitAction('MOVE_EAST');
    expect(clientWorld.getComponent(clientPlayer, Position)).toEqual({ x: 5, y: 5 });
    expect(clientTurnManager.getTurnNumber()).toBe(0);
    expect(clientTurnManager.canAcceptInput()).toBe(true);

    // Server executes bump: halts, ActionAbortedTag refunds cost, 0 turn cost
    serverTurnManager.submitAction('MOVE_EAST');
    expect(serverWorld.getComponent(serverPlayer, Position)).toEqual({ x: 5, y: 5 });
    expect(serverWorld.getComponent(serverPlayer, Energy)?.current).toBe(1000);
    expect(serverTurnManager.getTurnNumber()).toBe(0);

    // Parity: Both positions at (5, 5), player energy at 1000
    expect(clientWorld.getComponent(clientPlayer, Energy)?.current).toBe(
      serverWorld.getComponent(serverPlayer, Energy)?.current,
    );
  });

  it('maintains parity on bump safeguard (locked SecurityLock without key 0-cost halt)', () => {
    const serverPlayer = setupPlayer(serverWorld, serverGrid, 5, 5);
    const clientPlayer = setupPlayer(clientWorld, clientGrid, 5, 5);

    // Place locked prop at (6, 5)
    const createLock = (w: World<GameplayEvents>, g: Grid) => {
      const id = w.createEntity();
      w.addComponent(id, Position, { x: 6, y: 5 });
      w.addComponent(id, Prop, { propId: 'safe-1', faction: 'cyberacme', propClass: 'encrypted_safe', isSearched: false });
      w.addComponent(id, SecurityLock, { isLocked: true, overclockHeatCost: 35 });
      g.addEntity(id, 6, 5);
      return id;
    };

    createLock(serverWorld, serverGrid);
    createLock(clientWorld, clientGrid);

    serverTurnManager.start();
    clientTurnManager.start();

    // Client predicts bump: movement blocked
    clientTurnManager.submitAction('MOVE_EAST');
    expect(clientWorld.getComponent(clientPlayer, Position)).toEqual({ x: 5, y: 5 });

    // Server executes bump: movement blocked, 0 turn cost
    serverTurnManager.submitAction('MOVE_EAST');
    expect(serverWorld.getComponent(serverPlayer, Position)).toEqual({ x: 5, y: 5 });
    expect(serverWorld.getComponent(serverPlayer, Energy)?.current).toBe(1000);
    expect(serverTurnManager.getTurnNumber()).toBe(0);

    // Parity: Both positions and energies match
    expect(clientWorld.getComponent(clientPlayer, Position)).toEqual(
      serverWorld.getComponent(serverPlayer, Position),
    );
  });
});
