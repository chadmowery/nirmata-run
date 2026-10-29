import { describe, it, expect, vi } from 'vitest';
import { World } from '../../engine/ecs/world';
import { Grid } from '../../engine/grid/grid';
import { EventBus } from '../../engine/events/event-bus';
import { createRunEnderSystem } from './run-ender';
import {
  Actor,
  Position,
  FloorState,
  RunInventory,
  EquipmentSlots,
  MovedThisTurn,
  AIState,
  AIBehaviorType,
  AIBehavior,
  Dying,
  Stability,
  ExtractionIntent,
  RunCurrency,
} from '@shared/components';
import { Phase } from '../../engine/ecs/types';
import { GameplayEvents } from '@shared/events/types';

describe('RunEnderSystem', () => {
  it('should emit RUN_ENDED when ExtractionIntent is added', () => {
    const eventBus = new EventBus<GameplayEvents>();
    const world = new World<GameplayEvents>(eventBus);
    const grid = new Grid(10, 10);
    const system = createRunEnderSystem(world, grid, eventBus);
    system.init();

    const playerId = world.createEntity();
    world.addComponent(playerId, Actor, { isPlayer: true });
    world.addComponent(playerId, Position, { x: 1, y: 1 });
    world.addComponent(playerId, FloorState, { currentFloor: 5, maxFloor: 15, runSeed: 'test' });

    const runEndedSpy = vi.fn();
    eventBus.on('RUN_ENDED', runEndedSpy);

    world.addComponent(playerId, ExtractionIntent, { reason: 'manual' });
    world.executeSystems(Phase.CLEANUP);
    eventBus.flush();

    expect(runEndedSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: 'extraction',
        entityId: playerId,
        floorNumber: 5,
      }),
    );
  });

  it('should clear inventory and burned software on player death', () => {
    const eventBus = new EventBus<GameplayEvents>();
    const world = new World<GameplayEvents>(eventBus);
    const grid = new Grid(10, 10);
    const system = createRunEnderSystem(world, grid, eventBus);
    system.init();

    const playerId = world.createEntity();
    world.addComponent(playerId, Actor, { isPlayer: true });
    world.addComponent(playerId, Position, { x: 1, y: 1 });
    world.addComponent(playerId, RunInventory, { software: [], equipment: [], maxSlots: 5 });
    world.addComponent(playerId, EquipmentSlots, { weapon: 101, armor: 102 });

    // Mark as dying and execute cleanup
    world.addComponent(playerId, Dying, { killerId: 0 });
    world.executeSystems(Phase.CLEANUP);

    const burned = world.getComponent(playerId, EquipmentSlots);
    expect(burned?.weapon).toBe(null);
    expect(burned?.armor).toBe(null);
    expect(world.getComponent(playerId, RunInventory)?.software.length).toBe(0);
  });

  it('should end run when player moves adjacent to System_Admin', () => {
    const eventBus = new EventBus<GameplayEvents>();
    const world = new World<GameplayEvents>(eventBus);
    const grid = new Grid(10, 10);
    const system = createRunEnderSystem(world, grid, eventBus);
    system.init();

    const playerId = world.createEntity();
    world.addComponent(playerId, Actor, { isPlayer: true });
    world.addComponent(playerId, Position, { x: 5, y: 5 });

    const adminId = world.createEntity();
    world.addComponent(adminId, AIState, {
      behavior: AIBehavior.IDLE,
      behaviorType: AIBehaviorType.SYSTEM_ADMIN,
      sightRadius: 6,
    });
    world.addComponent(adminId, Position, { x: 6, y: 5 });

    const runEndedSpy = vi.fn();
    eventBus.on('RUN_ENDED', runEndedSpy);

    // Simulate player movement to (5, 5) which is adjacent to (6, 5)
    world.addComponent(playerId, MovedThisTurn, { fromX: 4, fromY: 5, toX: 5, toY: 5 });

    system.update(world);
    eventBus.flush();

    expect(runEndedSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: 'FATAL: ADMIN_CONTACT',
        entityId: playerId,
      }),
    );
  });

  it('should end run when player stability reaches zero', () => {
    const eventBus = new EventBus<GameplayEvents>();
    const world = new World<GameplayEvents>(eventBus);
    const grid = new Grid(10, 10);
    const system = createRunEnderSystem(world, grid, eventBus);
    system.init();

    const playerId = world.createEntity();
    world.addComponent(playerId, Actor, { isPlayer: true });
    world.addComponent(playerId, Position, { x: 1, y: 1 });
    world.addComponent(playerId, Stability, { current: 0, max: 100 });

    const runEndedSpy = vi.fn();
    eventBus.on('RUN_ENDED', runEndedSpy);

    world.executeSystems(Phase.CLEANUP);
    eventBus.flush();

    expect(runEndedSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: 'FATAL: REALITY_ANCHOR_COLLAPSED',
        entityId: playerId,
      }),
    );
  });

  it('should extract software, equipment, and blueprints on successful extraction', () => {
    const eventBus = new EventBus<GameplayEvents>();
    const world = new World<GameplayEvents>(eventBus);
    const grid = new Grid(10, 10);
    const system = createRunEnderSystem(world, grid, eventBus);
    system.init();

    const playerId = world.createEntity();
    world.addComponent(playerId, Actor, { isPlayer: true });
    world.addComponent(playerId, Position, { x: 1, y: 1 });
    world.addComponent(playerId, FloorState, { currentFloor: 3, maxFloor: 15, runSeed: 'test' });
    world.addComponent(playerId, RunInventory, {
      software: [
        {
          entityId: 101,
          templateId: 'bleed-v1',
          rarityTier: 'common',
          pickedUpAtFloor: 2,
          pickedUpAtTimestamp: 1000,
        },
      ],
      equipment: [
        {
          entityId: 102,
          templateId: 'rifle-v1',
          rarityTier: 'common',
          pickedUpAtFloor: 2,
          pickedUpAtTimestamp: 1000,
        },
      ],
      maxSlots: 5,
    });
    world.addComponent(playerId, RunCurrency, {
      stacks: [
        { currencyType: 'scrap', amount: 50 },
        { currencyType: 'blueprint', amount: 1, blueprintId: 'ghost-pulse', blueprintType: 'firmware' },
      ],
    });

    const runEndedSpy = vi.fn();
    eventBus.on('RUN_ENDED', runEndedSpy);

    world.addComponent(playerId, ExtractionIntent, { reason: 'manual' });
    world.executeSystems(Phase.CLEANUP);
    eventBus.flush();

    expect(runEndedSpy).toHaveBeenCalledTimes(1);
    const emittedStats = runEndedSpy.mock.calls[0][0].stats;

    expect(emittedStats.scrapExtracted).toBe(50);
    expect(emittedStats.itemsExtracted).toHaveLength(2);
    expect(emittedStats.itemsExtracted).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ templateId: 'bleed-v1', itemType: 'software' }),
        expect.objectContaining({ templateId: 'rifle-v1', itemType: 'equipment' }),
      ]),
    );
    expect(emittedStats.blueprintsExtracted).toEqual([
      { blueprintId: 'ghost-pulse', type: 'firmware' },
    ]);
  });
});
