import { describe, it, expect } from 'vitest';
import { AutoPathfinder } from '@dev-tool/debug/auto-pathfind';
import { World } from '@engine/ecs/world';
import { EventBus } from '@engine/events/event-bus';
import { Grid } from '@engine/grid/grid';
import { TurnManager } from '@engine/turn/turn-manager';
import { GameTurnAdapter } from '@/game/turn/game-turn-adapter';
import { Position, Health, AnchorMarker, StaircaseMarker, Prop, Hostile, BlocksMovement } from '@shared/components';
import { GameAction } from '@/game/input/actions';
import { GameContext } from '@/game/types';
import { GameEvents } from '@/game/events/types';

describe('AutoPathfinder Unit Tests', () => {
  it('paths around props instead of getting stuck bumping into them', async () => {
    const eventBus = new EventBus<GameEvents>();
    const world = new World<GameEvents>(eventBus);
    const grid = new Grid(5, 5);
    const turnAdapter = new GameTurnAdapter(world);
    const turnManager = new TurnManager(
      world,
      eventBus,
      {
        energyThreshold: 100,
        defaultActionCost: 100,
        waitActionCost: 50,
      },
      turnAdapter,
    );

    const playerId = world.createEntity();
    world.addComponent(playerId, Position, { x: 0, y: 0 });
    world.addComponent(playerId, Health, { current: 10, max: 10, isAlive: true });

    // Anchor at (2, 0)
    const anchorId = world.createEntity();
    world.addComponent(anchorId, Position, { x: 2, y: 0 });
    world.addComponent(anchorId, AnchorMarker, { used: false });

    // Prop at (1, 0) blocking direct path eastward
    const propId = world.createEntity();
    world.addComponent(propId, Position, { x: 1, y: 0 });
    world.addComponent(propId, Prop, {
      propId: 'test-prop',
      faction: 'sekiguchi',
      propClass: 'locker',
      isSearched: false,
    });
    grid.addEntity(propId, 1, 0);

    const actionsTaken: GameAction[] = [];
    const pathfinder = new AutoPathfinder(
      async () => {},
      (action: GameAction) => {
        actionsTaken.push(action);
        return { type: 'MOVE', dx: 0, dy: 1 };
      },
    );

    const context: Partial<GameContext> = {
      world,
      grid,
      turnManager,
      playerId,
      eventBus,
    };

    pathfinder.setContext(context as GameContext);

    pathfinder.start();

    // Allow loop to take first step
    await new Promise((resolve) => setTimeout(resolve, 60));
    pathfinder.cancel();

    expect(actionsTaken.length).toBeGreaterThan(0);
    // Direct path eastward is blocked by the prop at (1, 0), so it must take SOUTH (dy: 1) instead of EAST (dx: 1)
    expect(actionsTaken[0]).toBe(GameAction.MOVE_SOUTH);
  });

  it('finds path towards staircase when no stability anchor exists on floor', async () => {
    const eventBus = new EventBus<GameEvents>();
    const world = new World<GameEvents>(eventBus);
    const grid = new Grid(5, 5);
    const turnAdapter = new GameTurnAdapter(world);
    const turnManager = new TurnManager(
      world,
      eventBus,
      {
        energyThreshold: 100,
        defaultActionCost: 100,
        waitActionCost: 50,
      },
      turnAdapter,
    );

    const playerId = world.createEntity();
    world.addComponent(playerId, Position, { x: 0, y: 0 });
    world.addComponent(playerId, Health, { current: 10, max: 10, isAlive: true });

    // Staircase at (0, 3)
    const staircaseId = world.createEntity();
    world.addComponent(staircaseId, Position, { x: 0, y: 3 });
    world.addComponent(staircaseId, StaircaseMarker, { targetFloor: 2 });
    grid.addEntity(staircaseId, 0, 3);

    const actionsTaken: GameAction[] = [];
    const pathfinder = new AutoPathfinder(
      async () => {},
      (action: GameAction) => {
        actionsTaken.push(action);
        return { type: 'MOVE', dx: 0, dy: 1 };
      },
    );

    const context: Partial<GameContext> = {
      world,
      grid,
      turnManager,
      playerId,
      eventBus,
    };

    pathfinder.setContext(context as GameContext);
    pathfinder.start();

    await new Promise((resolve) => setTimeout(resolve, 60));
    pathfinder.cancel();

    expect(actionsTaken.length).toBeGreaterThan(0);
    expect(actionsTaken[0]).toBe(GameAction.MOVE_SOUTH);
  });

  it('bump attacks along the path when a hostile enemy blocks the corridor', async () => {
    const eventBus = new EventBus<GameEvents>();
    const world = new World<GameEvents>(eventBus);
    const grid = new Grid(3, 5);
    // Make 1-tile corridor at x=1: walls at x=0 and x=2
    for (let y = 0; y < 5; y++) {
      grid.setTile(0, y, { terrain: 'wall', walkable: false, transparent: false });
      grid.setTile(2, y, { terrain: 'wall', walkable: false, transparent: false });
      grid.setTile(1, y, { terrain: 'floor', walkable: true, transparent: true });
    }

    const turnAdapter = new GameTurnAdapter(world);
    const turnManager = new TurnManager(
      world,
      eventBus,
      {
        energyThreshold: 100,
        defaultActionCost: 100,
        waitActionCost: 50,
      },
      turnAdapter,
    );

    const playerId = world.createEntity();
    world.addComponent(playerId, Position, { x: 1, y: 0 });
    world.addComponent(playerId, Health, { current: 10, max: 10, isAlive: true });
    grid.addEntity(playerId, 1, 0);

    // Hostile enemy at (1, 1) directly blocking the single corridor
    const enemyId = world.createEntity();
    world.addComponent(enemyId, Position, { x: 1, y: 1 });
    world.addComponent(enemyId, Hostile, {});
    world.addComponent(enemyId, BlocksMovement, {});
    world.addComponent(enemyId, Health, { current: 5, max: 5, isAlive: true });
    grid.addEntity(enemyId, 1, 1);

    // Staircase at (1, 3)
    const stairId = world.createEntity();
    world.addComponent(stairId, Position, { x: 1, y: 3 });
    world.addComponent(stairId, StaircaseMarker, { targetFloor: 2 });
    grid.addEntity(stairId, 1, 3);

    const actionsTaken: GameAction[] = [];
    const pathfinder = new AutoPathfinder(
      async () => {},
      (action: GameAction) => {
        actionsTaken.push(action);
        return { type: 'MOVE', dx: 0, dy: 1 };
      },
    );

    const context: Partial<GameContext> = {
      world,
      grid,
      turnManager,
      playerId,
      eventBus,
    };

    pathfinder.setContext(context as GameContext);
    pathfinder.start();

    await new Promise((resolve) => setTimeout(resolve, 60));
    pathfinder.cancel();

    // Instead of failing or aborting, pathfinder advances directly into enemy tile (bump attack)
    expect(actionsTaken.length).toBeGreaterThan(0);
    expect(actionsTaken[0]).toBe(GameAction.MOVE_SOUTH);
  });

  it('toggles off when toggle() is called (user presses P again)', () => {
    const pathfinder = new AutoPathfinder(
      async () => {},
      () => null,
    );

    expect(pathfinder.isActive()).toBe(false);

    const world = new World<GameEvents>(new EventBus());
    const grid = new Grid(5, 5);
    const turnAdapter = new GameTurnAdapter(world);
    const turnManager = new TurnManager(
      world,
      new EventBus(),
      {
        energyThreshold: 100,
        defaultActionCost: 100,
        waitActionCost: 50,
      },
      turnAdapter,
    );
    const playerId = world.createEntity();
    world.addComponent(playerId, Position, { x: 0, y: 0 });
    world.addComponent(playerId, Health, { current: 10, max: 10, isAlive: true });
    const anchorId = world.createEntity();
    world.addComponent(anchorId, Position, { x: 4, y: 4 });
    world.addComponent(anchorId, AnchorMarker, { used: false });

    pathfinder.setContext({
      world,
      grid,
      turnManager,
      playerId,
      eventBus: new EventBus(),
    } as any);

    pathfinder.toggle();
    expect(pathfinder.isActive()).toBe(true);

    pathfinder.toggle();
    expect(pathfinder.isActive()).toBe(false);
  });
});
