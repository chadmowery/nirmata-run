import { describe, it, expect, beforeEach, vi } from 'vitest';
import { World } from '@engine/ecs/world';
import { Grid } from '@engine/grid/grid';
import { EventBus } from '@engine/events/event-bus';
import { GameplayEvents } from '@shared/events/types';
import { Position, Dying, Children, Actor } from '@shared/components';
import { createGravediggerSystem } from '../gravedigger';
import { Phase } from '@engine/ecs/types';

describe('GravediggerSystem (Death Protocol Enforcement)', () => {
  let world: World<GameplayEvents>;
  let grid: Grid;
  let eventBus: EventBus<GameplayEvents>;
  let gravedigger: ReturnType<typeof createGravediggerSystem>;

  beforeEach(() => {
    eventBus = new EventBus<GameplayEvents>();
    world = new World<GameplayEvents>(eventBus, { childComponentKey: 'children' });
    grid = new Grid(10, 10);
    gravedigger = createGravediggerSystem(world, grid);
    gravedigger.init();
  });

  it('removes dying entity from spatial grid and destroys it from ECS world', () => {
    const destroyedHandler = vi.fn();
    eventBus.on('ENTITY_DESTROYED', destroyedHandler);

    const enemy = world.createEntity();
    world.addComponent(enemy, Actor, { isPlayer: false });
    world.addComponent(enemy, Position, { x: 3, y: 4 });
    grid.addEntity(enemy, 3, 4);

    expect(grid.getEntitiesAt(3, 4).has(enemy)).toBe(true);

    // Mark entity as Dying
    world.addComponent(enemy, Dying, { killerId: 1, reason: 'combat' });

    // Execute CLEANUP phase
    world.executeSystems(Phase.CLEANUP);
    eventBus.flush();

    // Verify grid index was cleared
    expect(grid.getEntitiesAt(3, 4).has(enemy)).toBe(false);

    // Verify entity was destroyed in ECS
    expect(world.entityExists(enemy)).toBe(false);
    expect(destroyedHandler).toHaveBeenCalledWith({ entityId: enemy });
  });

  it('leaves non-dying entities untouched', () => {
    const survivor = world.createEntity();
    world.addComponent(survivor, Actor, { isPlayer: true });
    world.addComponent(survivor, Position, { x: 5, y: 5 });
    grid.addEntity(survivor, 5, 5);

    world.executeSystems(Phase.CLEANUP);

    expect(world.entityExists(survivor)).toBe(true);
    expect(grid.getEntitiesAt(5, 5).has(survivor)).toBe(true);
  });

  it('cleans up child entities when a dying parent is destroyed', () => {
    const parent = world.createEntity();
    const child1 = world.createEntity();
    const child2 = world.createEntity();

    world.addComponent(parent, Children, { entityIds: [child1, child2] });
    world.addComponent(parent, Position, { x: 1, y: 1 });
    grid.addEntity(parent, 1, 1);

    world.addComponent(parent, Dying, { reason: 'death' });

    world.executeSystems(Phase.CLEANUP);

    expect(world.entityExists(parent)).toBe(false);
    expect(world.entityExists(child1)).toBe(false);
    expect(world.entityExists(child2)).toBe(false);
  });
});
