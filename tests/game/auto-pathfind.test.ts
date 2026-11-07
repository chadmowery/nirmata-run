import { describe, it, expect } from 'vitest';
import { AutoPathfinder } from '@dev-tool/debug/auto-pathfind';
import { World } from '@engine/ecs/world';
import { EventBus } from '@engine/events/event-bus';
import { Grid } from '@engine/grid/grid';
import { TurnManager } from '@engine/turn/turn-manager';
import { GameTurnAdapter } from '@/game/turn/game-turn-adapter';
import { Position, Health, AnchorMarker, Prop } from '@shared/components';
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
});
