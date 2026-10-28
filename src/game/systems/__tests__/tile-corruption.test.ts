import { describe, it, expect, beforeEach, vi } from 'vitest';
import { World } from '@engine/ecs/world';
import { Grid } from '@engine/grid/grid';
import { EventBus } from '@engine/events/event-bus';
import { GameplayEvents } from '@shared/events/types';
import { Position, CorruptionState, Actor } from '@shared/components';
import { createTileCorruptionSystem } from '../tile-corruption';
import { Phase } from '@engine/ecs/types';

describe('TileCorruptionSystem Unit Tests', () => {
  let world: World<GameplayEvents>;
  let grid: Grid;
  let eventBus: EventBus<GameplayEvents>;
  let corruptionSystem: ReturnType<typeof createTileCorruptionSystem>;
  let seedEaterId: number;

  const dummyEntityFactory = { create: vi.fn() } as any;
  const dummyComponentRegistry = { get: vi.fn(), has: vi.fn() } as any;

  beforeEach(() => {
    eventBus = new EventBus<GameplayEvents>();
    world = new World<GameplayEvents>(eventBus);
    grid = new Grid(10, 10);

    // Make 10x10 grid floor
    for (let x = 0; x < 10; x++) {
      for (let y = 0; y < 10; y++) {
        grid.setTile(x, y, { terrain: 'floor', walkable: true, transparent: true });
      }
    }

    corruptionSystem = createTileCorruptionSystem(
      world,
      grid,
      eventBus,
      dummyEntityFactory,
      dummyComponentRegistry,
    );
    corruptionSystem.init();

    // Create player at (0, 0)
    const player = world.createEntity();
    world.addComponent(player, Actor, { isPlayer: true });
    world.addComponent(player, Position, { x: 0, y: 0 });
    grid.addEntity(player, 0, 0);

    // Create Seed Eater at (5, 5)
    seedEaterId = world.createEntity();
    world.addComponent(seedEaterId, Position, { x: 5, y: 5 });
    world.addComponent(seedEaterId, CorruptionState, {
      corruptionWave: 1,
      tilesPerTurn: 2,
      corruptedTileKeys: [],
      spawnFrequency: 3,
      turnsSinceLastSpawn: 0,
    });
    grid.addEntity(seedEaterId, 5, 5);
  });

  it('spreads corruption to tiles around Seed Eater and updates CorruptionState', () => {
    world.executeSystems(Phase.POST_TURN);

    const state = world.getComponent(seedEaterId, CorruptionState);
    expect(state?.corruptedTileKeys.length).toBeGreaterThan(0);
    // At least one tile's walkability in the grid was changed
    const corruptedKey = state!.corruptedTileKeys[0];
    const [cx, cy] = corruptedKey.split(',').map(Number);
    expect(grid.isWalkable(cx, cy)).toBe(false); // was floor (true), now wall (false)
  });

  it('displaces entities to nearest walkable tile when corruption turns floor into wall', () => {
    // Place victim at (5, 4) (distance 1 from Seed Eater at (5,5))
    const victim = world.createEntity();
    world.addComponent(victim, Actor, { isPlayer: false });
    world.addComponent(victim, Position, { x: 5, y: 4 });
    grid.addEntity(victim, 5, 4);

    // Force corruption wave 1 with 4 tiles per turn so (5, 4) is corrupted
    world.patchComponent(seedEaterId, CorruptionState, {
      corruptionWave: 1,
      tilesPerTurn: 4,
    });

    world.executeSystems(Phase.POST_TURN);

    // If (5, 4) was turned into a wall, victim must be displaced to a walkable tile
    const victimPos = world.getComponent(victim, Position)!;
    expect(grid.isWalkable(victimPos.x, victimPos.y)).toBe(true);
  });
});
