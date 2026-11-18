import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { World } from '@engine/ecs/world';
import { Grid } from '@engine/grid/grid';
import { EventBus } from '@engine/events/event-bus';
import { TurnManager } from '@engine/turn/turn-manager';
import { EntityRegistry } from '@engine/entity/registry';
import { EntityFactory } from '@engine/entity/factory';
import { registerGameTemplates } from '@game/entities';
import { sessionManager } from '@server/session/session-manager';
import { Position } from '@shared/components';
import type { GameplayEvents } from '@shared/events/types';
import type { EngineEvents } from '@engine/events/types';
import { handleServerDebugCommand } from '../server-debug-handler';

describe('handleServerDebugCommand SPAWN_ENTITY (MED-05)', () => {
  const prevEnv = process.env.NODE_ENV;

  beforeEach(() => {
    (process.env as Record<string, string>).NODE_ENV = 'development';
    sessionManager.clear();
  });

  afterEach(() => {
    (process.env as Record<string, string>).NODE_ENV = prevEnv;
    sessionManager.clear();
  });

  function setupSession() {
    const eventBus = new EventBus<GameplayEvents>();
    const world = new World<GameplayEvents>(eventBus);
    const grid = new Grid(10, 10);
    for (let y = 0; y < 10; y++) {
      for (let x = 0; x < 10; x++) {
        grid.setTile(x, y, { terrain: 'floor', walkable: true, transparent: true });
      }
    }
    const turnManager = new TurnManager(
      world,
      eventBus,
      { energyThreshold: 1000, defaultActionCost: 1000, waitActionCost: 500 },
      {
        getCandidateActors: () => [],
        isActorActive: () => true,
        canActorAct: () => true,
        accumulateEnergy: () => {},
        deductActionCost: () => {},
        isPrimaryActor: (id) => id === 1,
        getPrimaryActor: () => 1,
      },
    );
    const registry = new EntityRegistry();
    registerGameTemplates(registry);
    const entityFactory = new EntityFactory(registry);

    const playerId = world.createEntity();
    world.addComponent(playerId, Position, { x: 3, y: 3 });

    sessionManager.createSession('spawn-sess', {
      world: world as unknown as World<EngineEvents>,
      grid,
      turnManager: turnManager as unknown as TurnManager<EngineEvents>,
      eventBus: eventBus as unknown as EventBus<EngineEvents>,
      playerId,
      entityRegistry: registry,
      entityFactory,
    });

    return { world, grid, eventBus, playerId };
  }

  it('places spawned items and currencies into tile.items via grid.addItem and preserves walkability', () => {
    const { world, grid, eventBus, playerId } = setupSession();

    handleServerDebugCommand(world, eventBus, playerId, 'spawn-sess', 'SPAWN_ENTITY', {
      templateName: 'health-potion',
      dx: 1,
      dy: 0,
    });
    handleServerDebugCommand(world, eventBus, playerId, 'spawn-sess', 'SPAWN_ENTITY', {
      templateName: 'scrap',
      dx: 2,
      dy: 0,
    });

    const potionTile = grid.getTile(4, 3)!;
    expect(potionTile.items.size).toBe(1);
    expect(potionTile.entities.size).toBe(0);
    expect(potionTile.walkable).toBe(true);

    const scrapTile = grid.getTile(5, 3)!;
    expect(scrapTile.items.size).toBe(1);
    expect(scrapTile.entities.size).toBe(0);
    expect(scrapTile.walkable).toBe(true);
  });

  it('places spawned blocking enemies into tile.entities and marks tile non-walkable', () => {
    const { world, grid, eventBus, playerId } = setupSession();

    handleServerDebugCommand(world, eventBus, playerId, 'spawn-sess', 'SPAWN_ENTITY', {
      templateName: 'null-pointer',
      dx: 1,
      dy: 1,
    });

    const enemyTile = grid.getTile(4, 4)!;
    expect(enemyTile.entities.size).toBe(1);
    expect(enemyTile.items.size).toBe(0);
    expect(enemyTile.walkable).toBe(false);
  });
});
