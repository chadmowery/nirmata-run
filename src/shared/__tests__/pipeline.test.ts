import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '../../engine/ecs/world';
import { Grid } from '../../engine/grid/grid';
import { EventBus } from '../../engine/events/event-bus';
import { GameplayEvents } from '../events/types';
import { runActionPipeline } from '../pipeline';
import { Position, Health, Hostile, Attack, Defense, Actor } from '../../shared/components';

describe('ActionPipeline', () => {
  let world: World<GameplayEvents>;
  let grid: Grid;
  let eventBus: EventBus<GameplayEvents>;
  const PLAYER_ID = 1;
  const ENEMY_ID = 2;

  beforeEach(() => {
    eventBus = new EventBus();
    world = new World(eventBus);
    grid = new Grid(10, 10);
    
    // Setup Player
    const pId = world.createEntity(); // Should be 1
    world.addComponent(pId, Position, { x: 5, y: 5 });
    world.addComponent(pId, Health, { current: 10, max: 10 });
    world.addComponent(pId, Attack, { power: 3 });
    world.addComponent(pId, Actor, { isPlayer: true });
    grid.addEntity(pId, 5, 5);
  });

  it('should process a MOVE action and update state', () => {
    const action = { type: 'MOVE' as const, dx: 1, dy: 0 };
    const { world: newWorld, grid: newGrid, delta } = runActionPipeline(world, grid, PLAYER_ID, action);

    // Verify new state
    const pos = newWorld.getComponent(PLAYER_ID, Position);
    expect(pos).toEqual({ x: 6, y: 5 });
    expect(newGrid.getEntitiesAt(5, 5).size).toBe(0);
    expect(newGrid.getEntitiesAt(6, 5).has(PLAYER_ID)).toBe(true);

    // Verify delta exists
    expect(delta.world.length).toBeGreaterThan(0);
    expect(delta.grid.length).toBeGreaterThan(0);

    // Verify pureness (original state unchanged)
    expect(world.getComponent(PLAYER_ID, Position)).toEqual({ x: 5, y: 5 });
    expect(grid.getEntitiesAt(5, 5).has(PLAYER_ID)).toBe(true);
  });

  it('should process a MOVE action into an enemy as a bump attack', () => {
    // Setup Enemy
    const eId = world.createEntity(); // Should be 2
    world.addComponent(eId, Position, { x: 6, y: 5 });
    world.addComponent(eId, Health, { current: 10, max: 10 });
    world.addComponent(eId, Hostile, {});
    world.addComponent(eId, Defense, { armor: 1 });
    world.addComponent(eId, Actor, { isPlayer: false });
    grid.addEntity(eId, 6, 5);

    const action = { type: 'MOVE' as const, dx: 1, dy: 0 };
    const { world: newWorld, delta } = runActionPipeline(world, grid, PLAYER_ID, action);

    // Verify combat result
    const enemyHealth = newWorld.getComponent(ENEMY_ID, Health);
    // Player power 3 - Enemy armor 1 = 2 damage. 10 - 2 = 8.
    expect(enemyHealth?.current).toBe(8);

    // Player should NOT have moved
    const playerPos = newWorld.getComponent(PLAYER_ID, Position);
    expect(playerPos).toEqual({ x: 5, y: 5 });
  });

  it('should handle WAIT action with no changes', () => {
    const action = { type: 'WAIT' as const };
    const { delta } = runActionPipeline(world, grid, PLAYER_ID, action);

    expect(delta.world.length).toBe(0);
    expect(delta.grid.length).toBe(0);
  });
});
