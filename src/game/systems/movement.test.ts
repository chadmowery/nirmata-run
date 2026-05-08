import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMovementSystem } from './movement';
import { Grid } from '@engine/grid/grid';
import { World } from '@engine/ecs/world';
import { EventBus } from '@engine/events/event-bus';
import { Position } from '@shared/components/position';
import { Hostile } from '@shared/components/hostile';
import { Actor } from '@shared/components/actor';
import { BlocksMovement } from '@shared/components/blocks-movement';
import { GameplayEvents } from '@shared/events/types';

describe('MovementSystem', () => {
  let world: World<GameplayEvents>;
  let grid: Grid;
  let eventBus: EventBus<GameplayEvents>;
  let movementSystem: any;

  const PLAYER_ID = 1;
  const ENEMY_ID = 2;
  const WALL_ID = 3;

  beforeEach(() => {
    grid = new Grid(10, 10);
    // Set all tiles to walkable by default for testing
    for (let y = 0; y < 10; y++) {
      for (let x = 0; x < 10; x++) {
        grid.setTile(x, y, { walkable: true });
      }
    }

    world = {
      getComponent: vi.fn(),
      hasComponent: vi.fn(),
      patchComponent: vi.fn(),
    } as any;

    eventBus = {
      emit: vi.fn(),
    } as any;

    movementSystem = createMovementSystem(world, grid, eventBus);
  });

  it('should move entity successfully to an empty walkable tile', () => {
    vi.mocked(world.getComponent).mockImplementation((id, comp) => {
      if (id === PLAYER_ID && comp === Position) return { x: 5, y: 5 };
      return undefined;
    });
    grid.addEntity(PLAYER_ID, 5, 5);

    const result = movementSystem.processMove(PLAYER_ID, 1, 0); // Move East

    expect(result).toBe('moved');
    expect(world.patchComponent).toHaveBeenCalledWith(PLAYER_ID, Position, { x: 6, y: 5 });
    expect(grid.getEntitiesAt(5, 5).has(PLAYER_ID)).toBe(false);
    expect(grid.getEntitiesAt(6, 5).has(PLAYER_ID)).toBe(true);
  });

  it('should support all four cardinal directions', () => {
    vi.mocked(world.getComponent).mockImplementation((id, comp) => {
      if (id === PLAYER_ID && comp === Position) return { x: 5, y: 5 };
      return undefined;
    });

    movementSystem.processMove(PLAYER_ID, 0, -1); // North
    expect(world.patchComponent).toHaveBeenCalledWith(PLAYER_ID, Position, { x: 5, y: 4 });

    movementSystem.processMove(PLAYER_ID, 0, 1); // South
    expect(world.patchComponent).toHaveBeenCalledWith(PLAYER_ID, Position, { x: 5, y: 6 });

    movementSystem.processMove(PLAYER_ID, -1, 0); // West
    expect(world.patchComponent).toHaveBeenCalledWith(PLAYER_ID, Position, { x: 4, y: 5 });

    movementSystem.processMove(PLAYER_ID, 1, 0); // East
    expect(world.patchComponent).toHaveBeenCalledWith(PLAYER_ID, Position, { x: 6, y: 5 });
  });

  it('should block movement if target is out of bounds', () => {
    vi.mocked(world.getComponent).mockImplementation((id, comp) => {
      if (id === PLAYER_ID && comp === Position) return { x: 0, y: 0 };
      return undefined;
    });
    grid.addEntity(PLAYER_ID, 0, 0);

    const result = movementSystem.processMove(PLAYER_ID, -1, 0);

    expect(result).toBe('blocked');
    expect(grid.getEntitiesAt(0, 0).has(PLAYER_ID)).toBe(true);
  });

  it('should block movement if target tile is not walkable', () => {
    vi.mocked(world.getComponent).mockImplementation((id, comp) => {
      if (id === PLAYER_ID && comp === Position) return { x: 5, y: 5 };
      return undefined;
    });
    grid.setTile(6, 5, { walkable: false });
    grid.addEntity(PLAYER_ID, 5, 5);

    const result = movementSystem.processMove(PLAYER_ID, 1, 0);

    expect(result).toBe('blocked');
  });

  it('should trigger BUMP_ATTACK when moving into a hostile entity', () => {
    vi.mocked(world.getComponent).mockImplementation((id, comp) => {
      if (id === PLAYER_ID && comp === Position) return { x: 5, y: 5 };
      if (id === PLAYER_ID && comp === Actor) return { isPlayer: true };
      if (id === ENEMY_ID && comp === Actor) return { isPlayer: false };
      return undefined;
    });
    vi.mocked(world.hasComponent).mockImplementation((id, comp) => {
      if (id === ENEMY_ID && comp === Hostile) return true;
      return false;
    });

    grid.addEntity(PLAYER_ID, 5, 5);
    grid.addEntity(ENEMY_ID, 6, 5);

    const result = movementSystem.processMove(PLAYER_ID, 1, 0);

    expect(result).toBe('bump-attack');
    expect(world.patchComponent).not.toHaveBeenCalled(); // Player doesn't move
    expect(eventBus.emit).toHaveBeenCalledWith('BUMP_ATTACK', {
      attackerId: PLAYER_ID,
      defenderId: ENEMY_ID,
    });
  });

  it('should block movement when moving into a non-hostile blocking entity', () => {
    vi.mocked(world.getComponent).mockImplementation((id, comp) => {
      if (id === PLAYER_ID && comp === Position) return { x: 5, y: 5 };
      return undefined;
    });
    vi.mocked(world.hasComponent).mockImplementation((id, comp) => {
      if (id === WALL_ID && comp === BlocksMovement) return true;
      return false;
    });

    grid.addEntity(PLAYER_ID, 5, 5);
    grid.addEntity(WALL_ID, 6, 5);

    const result = movementSystem.processMove(PLAYER_ID, 1, 0);

    expect(result).toBe('blocked');
    expect(world.patchComponent).not.toHaveBeenCalled();
    expect(eventBus.emit).not.toHaveBeenCalled();
  });

  it('should allow moving into a non-blocking non-hostile entity', () => {
    const ITEM_ID = 4;
    vi.mocked(world.getComponent).mockImplementation((id, comp) => {
      if (id === PLAYER_ID && comp === Position) return { x: 5, y: 5 };
      return undefined;
    });
    vi.mocked(world.hasComponent).mockReturnValue(false);

    grid.addEntity(PLAYER_ID, 5, 5);
    grid.addEntity(ITEM_ID, 6, 5);

    const result = movementSystem.processMove(PLAYER_ID, 1, 0);

    expect(result).toBe('moved');
    expect(world.patchComponent).toHaveBeenCalledWith(PLAYER_ID, Position, expect.objectContaining({ x: 6 }));
  });
});
