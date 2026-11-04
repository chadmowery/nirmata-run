import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '@engine/ecs/world';
import { Grid } from '@engine/grid/grid';
import { EventBus } from '@engine/events/event-bus';
import { TurnManager } from '@engine/turn/turn-manager';
import { GameTurnAdapter } from '@game/turn/game-turn-adapter';
import { createMovementSystem } from '@game/systems/movement';
import { InputManager } from '@game/input/input-manager';
import { GameAction, DIRECTIONS } from '@game/input/actions';
import {
  Position,
  Actor,
  Energy,
  Health,
  MoveIntent,
  Prop,
  CorruptedNode,
  SecurityLock,
  FloorState,
  Hostile,
} from '@shared/components';
import { GameplayEvents } from '@shared/events/types';

describe('C5 Two-Tier Bump Safeguard Verification (TurnManager Level)', () => {
  let world: World<GameplayEvents>;
  let grid: Grid;
  let eventBus: EventBus<GameplayEvents>;
  let turnManager: TurnManager<GameplayEvents>;
  let adapter: GameTurnAdapter<GameplayEvents>;
  let playerId: number;

  beforeEach(() => {
    eventBus = new EventBus<GameplayEvents>();
    world = new World<GameplayEvents>(eventBus);
    grid = new Grid(20, 20);

    for (let y = 0; y < 20; y++) {
      for (let x = 0; x < 20; x++) {
        grid.setTile(x, y, { walkable: true });
      }
    }

    adapter = new GameTurnAdapter(world, {
      defaultActionCost: 1000,
      waitActionCost: 500,
    });

    turnManager = new TurnManager(
      world,
      eventBus,
      {
        energyThreshold: 1000,
        defaultActionCost: 1000,
        waitActionCost: 500,
      },
      adapter,
    );

    // Initialize MovementSystem
    const movementSystem = createMovementSystem(world, grid, eventBus, false);
    movementSystem.init();

    // Wire player action handler
    turnManager.setPlayerActionHandler((action: string, entityId: number) => {
      if (action === 'MOVE_EAST') {
        world.addComponent(entityId, MoveIntent, { dx: 1, dy: 0 });
      } else if (action === 'MOVE_SOUTH') {
        world.addComponent(entityId, MoveIntent, { dx: 0, dy: 1 });
      }
    });

    // Create player at (5, 5) with 1000 energy
    playerId = world.createEntity();
    world.addComponent(playerId, Actor, { isPlayer: true });
    world.addComponent(playerId, Position, { x: 5, y: 5 });
    world.addComponent(playerId, Energy, { current: 1000, speed: 100, threshold: 1000 });
    world.addComponent(playerId, Health, { current: 20, max: 20, isAlive: true });
    world.addComponent(playerId, FloorState, { currentFloor: 1, maxFloor: 15, runSeed: 'test-seed' });
    grid.addEntity(playerId, 5, 5);
  });

  it('halts movement at 0 turn cost and clears input buffer when bumping armed CorruptedNode', () => {
    // Armed CorruptedNode prop at (6, 5)
    const corruptedPropId = world.createEntity();
    world.addComponent(corruptedPropId, Prop, {
      propId: 'corrupted-terminal',
      faction: 'system',
      propClass: 'workstation',
      isSearched: false,
    });
    world.addComponent(corruptedPropId, CorruptedNode, {
      isDisarmed: false,
      triggered: false,
      trapType: 'acoustic_alert',
      revealed: false,
    });
    world.addComponent(corruptedPropId, Position, { x: 6, y: 5 });
    grid.addEntity(corruptedPropId, 6, 5);

    // Ready enemy at (8, 5) with 1000 energy
    const enemyId = world.createEntity();
    world.addComponent(enemyId, Actor, { isPlayer: false });
    world.addComponent(enemyId, Hostile, {});
    world.addComponent(enemyId, Position, { x: 8, y: 5 });
    world.addComponent(enemyId, Energy, { current: 1000, speed: 100, threshold: 1000 });
    world.addComponent(enemyId, Health, { current: 10, max: 10, isAlive: true });
    grid.addEntity(enemyId, 8, 5);

    const emittedMessages: string[] = [];
    let inputBufferClearedEmitted = false;
    eventBus.on('MESSAGE_EMITTED', (payload) => emittedMessages.push(payload.text));
    eventBus.on('INPUT_BUFFER_CLEARED', () => {
      inputBufferClearedEmitted = true;
    });

    turnManager.start();
    expect(turnManager.getTurnNumber()).toBe(0);

    // Player attempts to bump into the armed corrupted node
    turnManager.submitAction('MOVE_EAST');

    // 1. Energy must remain 1000 (0 turn cost, refunded)
    const playerEnergy = world.getComponent(playerId, Energy);
    expect(playerEnergy?.current).toBe(1000);

    // 2. Player position must remain (5, 5) (halted!)
    const playerPos = world.getComponent(playerId, Position);
    expect(playerPos).toEqual({ x: 5, y: 5 });

    // 3. TurnManager turnNumber must NOT advance (remains 0)
    expect(turnManager.getTurnNumber()).toBe(0);

    // 4. Enemy with 1000 energy must NOT have taken a turn (energy remains 1000)
    const enemyEnergy = world.getComponent(enemyId, Energy);
    expect(enemyEnergy?.current).toBe(1000);

    // 5. INPUT_BUFFER_CLEARED event was emitted
    expect(inputBufferClearedEmitted).toBe(true);

    // 6. Security fault alert message was emitted
    expect(emittedMessages.some((msg) => msg.includes('[SECURITY FAULT]'))).toBe(true);
  });

  it('halts movement at 0 turn cost and clears input buffer when bumping locked SecurityLock without key', () => {
    // Locked safe at (5, 6)
    const lockedSafeId = world.createEntity();
    world.addComponent(lockedSafeId, Prop, {
      propId: 'locked-safe',
      faction: 'system',
      propClass: 'encrypted_safe',
      isSearched: false,
    });
    world.addComponent(lockedSafeId, SecurityLock, {
      isLocked: true,
      overclockHeatCost: 35,
      alertRadiusOnBypass: 12,
    });
    world.addComponent(lockedSafeId, Position, { x: 5, y: 6 });
    grid.addEntity(lockedSafeId, 5, 6);

    const emittedMessages: string[] = [];
    let inputBufferClearedEmitted = false;
    eventBus.on('MESSAGE_EMITTED', (payload) => emittedMessages.push(payload.text));
    eventBus.on('INPUT_BUFFER_CLEARED', () => {
      inputBufferClearedEmitted = true;
    });

    turnManager.start();
    expect(turnManager.getTurnNumber()).toBe(0);

    // Player attempts to bump into the locked prop without an access key
    turnManager.submitAction('MOVE_SOUTH');

    // 1. Energy must remain 1000 (0 turn cost, refunded)
    const playerEnergy = world.getComponent(playerId, Energy);
    expect(playerEnergy?.current).toBe(1000);

    // 2. Player position must remain (5, 5)
    const playerPos = world.getComponent(playerId, Position);
    expect(playerPos).toEqual({ x: 5, y: 5 });

    // 3. TurnManager turnNumber must NOT advance (remains 0)
    expect(turnManager.getTurnNumber()).toBe(0);

    // 4. INPUT_BUFFER_CLEARED event was emitted
    expect(inputBufferClearedEmitted).toBe(true);

    // 5. Overclock warning message was emitted
    expect(emittedMessages.some((msg) => msg.includes('[OVERCLOCK WARNING]'))).toBe(true);
  });

  it('flushes InputManager actionQueue when INPUT_BUFFER_CLEARED is emitted', () => {
    const inputManager = new InputManager();

    // Wire listener as done in setup.ts
    eventBus.on('INPUT_BUFFER_CLEARED', () => {
      inputManager.clearQueue();
    });

    // Simulate buffered inputs during in-flight action
    inputManager.setRequestPending(true);
    // Queue two movement actions
    (inputManager as any).actionQueue.push(GameAction.MOVE_NORTH);
    (inputManager as any).actionQueue.push(GameAction.MOVE_EAST);
    expect(inputManager.getQueueLength()).toBe(2);

    // Emit INPUT_BUFFER_CLEARED
    eventBus.emit('INPUT_BUFFER_CLEARED', {});
    eventBus.flush();

    // Queue must be flushed to 0
    expect(inputManager.getQueueLength()).toBe(0);
  });
});
