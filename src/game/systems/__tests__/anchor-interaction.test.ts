import { describe, it, expect, beforeEach, vi } from 'vitest';
import { World } from '@engine/ecs/world';
import { Grid } from '@engine/grid/grid';
import { EventBus } from '@engine/events/event-bus';
import { GameplayEvents } from '@shared/events/types';
import {
  Actor,
  Position,
  AnchorMarker,
  StaircaseMarker,
  MovedThisTurn,
  Acting,
  FloorState,
  Stability,
  RunInventory,
  RunCurrency,
} from '@shared/components';
import { createAnchorInteractionSystem } from '../anchor-interaction';
import { Phase } from '@engine/ecs/types';

describe('AnchorInteractionSystem Unit Tests', () => {
  let world: World<GameplayEvents>;
  let grid: Grid;
  let eventBus: EventBus<GameplayEvents>;
  let anchorSystem: ReturnType<typeof createAnchorInteractionSystem>;
  let playerId: number;

  beforeEach(() => {
    eventBus = new EventBus<GameplayEvents>();
    world = new World<GameplayEvents>(eventBus);
    grid = new Grid(10, 10);

    anchorSystem = createAnchorInteractionSystem(world, grid, eventBus);
    anchorSystem.init();

    playerId = world.createEntity();
    world.addComponent(playerId, Actor, { isPlayer: true });
    world.addComponent(playerId, Position, { x: 4, y: 4 });
    world.addComponent(playerId, FloorState, { currentFloor: 5, maxFloor: 15, runSeed: 'test' });
    world.addComponent(playerId, Stability, { current: 75, max: 100 });
    world.addComponent(playerId, RunInventory, {
      software: [],
      equipment: [],
      maxSlots: 5,
    });
    world.addComponent(playerId, RunCurrency, {
      stacks: [{ currencyType: 'scrap', amount: 120 }],
    });
    grid.addEntity(playerId, 4, 4);
  });

  it('triggers ANCHOR_INTERACTION event with full modal payload when player moves onto Anchor tile', () => {
    const anchorHandler = vi.fn();
    const messageHandler = vi.fn();
    eventBus.on('ANCHOR_INTERACTION', anchorHandler);
    eventBus.on('MESSAGE_EMITTED', messageHandler);

    // Create Anchor entity at (4, 4)
    const anchorId = world.createEntity();
    world.addComponent(anchorId, AnchorMarker, { used: false });
    world.addComponent(anchorId, Position, { x: 4, y: 4 });
    grid.addEntity(anchorId, 4, 4);

    // Simulate player moved this turn and is acting
    world.addComponent(playerId, MovedThisTurn, { fromX: 4, fromY: 3, toX: 4, toY: 4 });
    world.addComponent(playerId, Acting, {});

    world.executeSystems(Phase.REACTION);
    eventBus.flush();

    expect(anchorHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        entityId: playerId,
        anchorId,
        floorNumber: 5,
        stabilityPercent: 75,
        inventory: expect.objectContaining({
          scrap: 120,
        }),
      }),
    );

    expect(messageHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining('Reality Anchor active'),
      }),
    );
  });

  it('triggers STAIRCASE_INTERACTION when player moves onto Staircase tile', () => {
    const staircaseHandler = vi.fn();
    eventBus.on('STAIRCASE_INTERACTION', staircaseHandler);

    const stairId = world.createEntity();
    world.addComponent(stairId, StaircaseMarker, { targetFloor: 6 });
    world.addComponent(stairId, Position, { x: 4, y: 4 });
    grid.addEntity(stairId, 4, 4);

    world.addComponent(playerId, MovedThisTurn, { fromX: 4, fromY: 3, toX: 4, toY: 4 });
    world.addComponent(playerId, Acting, {});

    world.executeSystems(Phase.REACTION);
    eventBus.flush();

    expect(staircaseHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        entityId: playerId,
        staircaseId: stairId,
        targetFloor: 6,
      }),
    );
  });

  it('does not trigger interaction if player did not move this turn', () => {
    const anchorHandler = vi.fn();
    eventBus.on('ANCHOR_INTERACTION', anchorHandler);

    const anchorId = world.createEntity();
    world.addComponent(anchorId, AnchorMarker, { used: false });
    world.addComponent(anchorId, Position, { x: 4, y: 4 });
    grid.addEntity(anchorId, 4, 4);

    // Player at same tile, but no MovedThisTurn component
    world.executeSystems(Phase.REACTION);
    eventBus.flush();

    expect(anchorHandler).not.toHaveBeenCalled();
  });
});
