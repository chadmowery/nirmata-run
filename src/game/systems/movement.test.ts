import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMovementSystem } from './movement';
import { Grid } from '@engine/grid/grid';
import { World } from '@engine/ecs/world';
import { EventBus } from '@engine/events/event-bus';
import { Position } from '../components/position';
import { Hostile } from '../components/hostile';
import { BlocksMovement } from '../components/blocks-movement';
import { GameEvents } from '../events/types';

describe('MovementSystem', () => {
  let world: World;
  let grid: Grid;
  let eventBus: EventBus<GameEvents>;
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
    } as any;

    eventBus = {
      emit: vi.fn(),
    } as any;

    movementSystem = createMovementSystem(world, grid, eventBus);
  });

  it('should move entity successfully to an empty walkable tile', () => {
    const pos = { x: 5, y: 5 };
    vi.mocked(world.getComponent).mockReturnValue(pos);
    grid.addEntity(PLAYER_ID, 5, 5);

    const result = movementSystem.processMove(PLAYER_ID, 1, 0); // Move East

    expect(result).toBe('moved');
    expect(pos.x).toBe(6);
    expect(pos.y).toBe(5);
    expect(grid.getEntitiesAt(5, 5).has(PLAYER_ID)).toBe(false);
    expect(grid.getEntitiesAt(6, 5).has(PLAYER_ID)).toBe(true);
  });

  it('should support all four cardinal directions', () => {
    const pos = { x: 5, y: 5 };
    vi.mocked(world.getComponent).mockReturnValue(pos);

    movementSystem.processMove(PLAYER_ID, 0, -1); // North
    expect(pos.y).toBe(4);

    movementSystem.processMove(PLAYER_ID, 0, 1); // South
    expect(pos.y).toBe(5);

    movementSystem.processMove(PLAYER_ID, -1, 0); // West
    expect(pos.x).toBe(4);

    movementSystem.processMove(PLAYER_ID, 1, 0); // East
    expect(pos.x).toBe(5);
  });

  it('should block movement if target is out of bounds', () => {
    const pos = { x: 0, y: 0 };
    vi.mocked(world.getComponent).mockReturnValue(pos);
    grid.addEntity(PLAYER_ID, 0, 0);

    const result = movementSystem.processMove(PLAYER_ID, -1, 0);

    expect(result).toBe('blocked');
    expect(pos.x).toBe(0);
    expect(grid.getEntitiesAt(0, 0).has(PLAYER_ID)).toBe(true);
  });

  it('should block movement if target tile is not walkable', () => {
    const pos = { x: 5, y: 5 };
    vi.mocked(world.getComponent).mockReturnValue(pos);
    grid.setTile(6, 5, { walkable: false });
    grid.addEntity(PLAYER_ID, 5, 5);

    const result = movementSystem.processMove(PLAYER_ID, 1, 0);

    expect(result).toBe('blocked');
    expect(pos.x).toBe(5);
  });

  it('should trigger BUMP_ATTACK when moving into a hostile entity', () => {
    const playerPos = { x: 5, y: 5 };
    vi.mocked(world.getComponent).mockReturnValue(playerPos);
    vi.mocked(world.hasComponent).mockImplementation((id, comp) => {
      if (id === ENEMY_ID && comp === Hostile) return true;
      return false;
    });

    grid.addEntity(PLAYER_ID, 5, 5);
    grid.addEntity(ENEMY_ID, 6, 5);

    const result = movementSystem.processMove(PLAYER_ID, 1, 0);

    expect(result).toBe('bump-attack');
    expect(playerPos.x).toBe(5); // Player doesn't move
    expect(eventBus.emit).toHaveBeenCalledWith('BUMP_ATTACK', {
      attackerId: PLAYER_ID,
      defenderId: ENEMY_ID,
    });
  });

  it('should block movement when moving into a non-hostile blocking entity', () => {
    const playerPos = { x: 5, y: 5 };
    vi.mocked(world.getComponent).mockReturnValue(playerPos);
    vi.mocked(world.hasComponent).mockImplementation((id, comp) => {
      if (id === WALL_ID && comp === BlocksMovement) return true;
      return false;
    });

    grid.addEntity(PLAYER_ID, 5, 5);
    grid.addEntity(WALL_ID, 6, 5);

    const result = movementSystem.processMove(PLAYER_ID, 1, 0);

    expect(result).toBe('blocked');
    expect(playerPos.x).toBe(5);
    expect(eventBus.emit).not.toHaveBeenCalled();
  });

  it('should allow moving into a non-blocking non-hostile entity', () => {
    const playerPos = { x: 5, y: 5 };
    const ITEM_ID = 4;
    vi.mocked(world.getComponent).mockReturnValue(playerPos);
    vi.mocked(world.hasComponent).mockReturnValue(false);

    grid.addEntity(PLAYER_ID, 5, 5);
    grid.addEntity(ITEM_ID, 6, 5);

    const result = movementSystem.processMove(PLAYER_ID, 1, 0);

    expect(result).toBe('moved');
    expect(playerPos.x).toBe(6);
  });
});
