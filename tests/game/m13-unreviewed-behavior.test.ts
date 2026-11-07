import { describe, it, expect, beforeEach, vi } from 'vitest';
import { World } from '@engine/ecs/world';
import { Grid } from '@engine/grid/grid';
import { EventBus } from '@engine/events/event-bus';
import { EngineEvents } from '@engine/events/types';
import { GameplayEvents } from '@shared/events/types';
import {
  Actor,
  Energy,
  Health,
  Acting,
  Dying,
  Position,
  AnchorMarker,
  Hostile,
  BlocksMovement,
  Prop,
} from '@shared/components';
import { GameTurnAdapter } from '../../src/game/turn/game-turn-adapter';
import { AutoPathfinder } from '@dev-tool/debug/auto-pathfind';
import { DEFAULT_SHELL_ID } from '@shared/constants';
import { globalShellRegistry } from '../../src/game/shells/client';
import { createGame } from '../../src/game/setup';
import { GameContext } from '../../src/game/types';

describe('M13: Unreviewed Behaviour Changes Remediation', () => {
  describe('1. Default Shell Archetype Unification', () => {
    it('defines canonical DEFAULT_SHELL_ID as vanguard-v1', () => {
      expect(DEFAULT_SHELL_ID).toBe('vanguard-v1');
      expect(globalShellRegistry.getTemplates().some((t) => t.id === DEFAULT_SHELL_ID)).toBe(true);
    });

    it('createGame defaults shell to DEFAULT_SHELL_ID when unspecified', () => {
      const context = createGame({
        gridWidth: 20,
        gridHeight: 20,
        seed: 'test-shell-default',
      });

      expect(context.playerId).toBeDefined();
      const shellRecord = globalShellRegistry.get(DEFAULT_SHELL_ID);
      expect(shellRecord).toBeDefined();
      expect(shellRecord?.archetypeId).toBe('vanguard-v1');
    });
  });

  describe('2. AutoPathfinder Corridor & Hostile Pathfinding', () => {
    let world: World<GameplayEvents>;
    let grid: Grid;
    let eventBus: EventBus<GameplayEvents>;
    let pathfinder: AutoPathfinder;
    let context: GameContext;
    let playerId: number;
    let anchorId: number;

    beforeEach(() => {
      eventBus = new EventBus<GameplayEvents>();
      world = new World<GameplayEvents>(eventBus);
      grid = new Grid(10, 10);

      // Create a 1-tile corridor at y=5 from x=1 to x=8, surrounded by walls
      for (let x = 0; x < 10; x++) {
        for (let y = 0; y < 10; y++) {
          if (y === 5 && x >= 1 && x <= 8) {
            grid.setTile(x, y, { walkable: true });
          } else {
            grid.setTile(x, y, { walkable: false });
          }
        }
      }

      playerId = world.createEntity();
      world.addComponent(playerId, Actor, { isPlayer: true });
      world.addComponent(playerId, Position, { x: 1, y: 5 });
      world.addComponent(playerId, Health, { current: 100, max: 100, isAlive: true });
      grid.addEntity(playerId, 1, 5);

      anchorId = world.createEntity();
      world.addComponent(anchorId, AnchorMarker, { used: false });
      world.addComponent(anchorId, Position, { x: 8, y: 5 });
      grid.addEntity(anchorId, 8, 5);

      pathfinder = new AutoPathfinder(
        async () => {},
        () => null,
      );

      context = {
        world: world as any,
        grid,
        eventBus: eventBus as any,
        turnManager: {
          canAcceptInput: () => true,
          submitAction: vi.fn(),
        } as any,
        playerId,
      } as unknown as GameContext;

      pathfinder.setContext(context);
    });

    it('falls back to compute path through corridor containing a Hostile rather than failing with path.length === 0', () => {
      // Place hostile directly in the middle of the only 1-tile corridor at (4, 5)
      const hostileId = world.createEntity();
      world.addComponent(hostileId, Hostile, {});
      world.addComponent(hostileId, Position, { x: 4, y: 5 });
      grid.addEntity(hostileId, 4, 5);

      // Compute path
      const playerPos = world.getComponent(playerId, Position)!;
      const anchorPos = world.getComponent(anchorId, Position)!;

      const path = (pathfinder as any).computePath(playerPos, anchorPos);

      // Path must NOT be empty (previously treat Hostile as wall resulted in path.length === 0)
      expect(path.length).toBeGreaterThan(0);
      expect(path[0]).toEqual([1, 5]);
      expect(path[path.length - 1]).toEqual([8, 5]);
      // The path should step through the corridor towards the enemy
      expect(path[1]).toEqual([2, 5]);
    });

    it('allows pathfinding through non-blocking props in corridor', () => {
      // Place a searchable container at (3, 5) without BlocksMovement
      const propId = world.createEntity();
      world.addComponent(propId, Prop, {
        propId: 'container-1',
        faction: 'traxus',
        propClass: 'locker',
        isSearched: false,
      });
      world.addComponent(propId, Position, { x: 3, y: 5 });
      grid.addEntity(propId, 3, 5);

      const playerPos = world.getComponent(playerId, Position)!;
      const anchorPos = world.getComponent(anchorId, Position)!;

      const path = (pathfinder as any).computePath(playerPos, anchorPos);
      expect(path.length).toBeGreaterThan(0);
      expect(path[path.length - 1]).toEqual([8, 5]);
    });

    it('respects hard BlocksMovement entities as impassable barriers', () => {
      // Place a blast door or wall with BlocksMovement at (4, 5)
      const doorId = world.createEntity();
      world.addComponent(doorId, BlocksMovement, {});
      world.addComponent(doorId, Position, { x: 4, y: 5 });
      grid.addEntity(doorId, 4, 5);

      const playerPos = world.getComponent(playerId, Position)!;
      const anchorPos = world.getComponent(anchorId, Position)!;

      const path = (pathfinder as any).computePath(playerPos, anchorPos);
      // Truly blocked by physical obstacle -> path is empty
      expect(path.length).toBe(0);
    });
  });

  describe('3. GameTurnAdapter Dying Checks & Entity Existence Guards', () => {
    let world: World<EngineEvents>;
    let adapter: GameTurnAdapter<EngineEvents>;

    beforeEach(() => {
      const eventBus = new EventBus<EngineEvents>();
      world = new World<EngineEvents>(eventBus);
      adapter = new GameTurnAdapter(world, {
        defaultActionCost: 1000,
        waitActionCost: 500,
      });
    });

    it('isActorActive returns false for entities with Dying or non-existent entities', () => {
      const entity = world.createEntity();
      world.addComponent(entity, Actor, { isPlayer: false });
      world.addComponent(entity, Health, { current: 10, max: 10, isAlive: true });
      expect(adapter.isActorActive(entity)).toBe(true);

      // Attach Dying
      world.addComponent(entity, Dying, { reason: 'damage' });
      expect(adapter.isActorActive(entity)).toBe(false);

      // Non-existent entity
      expect(adapter.isActorActive(99999)).toBe(false);
    });

    it('canActorAct returns false for entities with Dying or non-existent entities', () => {
      const entity = world.createEntity();
      world.addComponent(entity, Actor, { isPlayer: false });
      world.addComponent(entity, Energy, { current: 1000, speed: 100, threshold: 1000 });
      expect(adapter.canActorAct(entity, 1000)).toBe(true);

      // Attach Dying
      world.addComponent(entity, Dying, { reason: 'damage' });
      expect(adapter.canActorAct(entity, 1000)).toBe(false);

      // Non-existent entity
      expect(adapter.canActorAct(99999, 1000)).toBe(false);
    });

    it('accumulateEnergy does not add energy to Dying entities or non-existent entities', () => {
      const entity = world.createEntity();
      world.addComponent(entity, Energy, { current: 500, speed: 100, threshold: 1000 });
      world.addComponent(entity, Dying, { reason: 'damage' });

      adapter.accumulateEnergy(entity);
      expect(world.getComponent(entity, Energy)?.current).toBe(500);

      // Non-existent entity does not throw
      expect(() => adapter.accumulateEnergy(99999)).not.toThrow();
    });

    it('getCandidateActors filters out entities marked with Dying', () => {
      const living = world.createEntity();
      world.addComponent(living, Actor, { isPlayer: false });
      world.addComponent(living, Energy, { current: 1000, speed: 100, threshold: 1000 });

      const dying = world.createEntity();
      world.addComponent(dying, Actor, { isPlayer: false });
      world.addComponent(dying, Energy, { current: 1000, speed: 100, threshold: 1000 });
      world.addComponent(dying, Dying, { reason: 'damage' });

      const candidates = adapter.getCandidateActors();
      expect(candidates).toContain(living);
      expect(candidates).not.toContain(dying);
    });

    it('onBeforeActorAct does not attach Acting to Dying entities or non-existent entities', () => {
      const entity = world.createEntity();
      world.addComponent(entity, Actor, { isPlayer: false });
      world.addComponent(entity, Dying, { reason: 'damage' });

      adapter.onBeforeActorAct(entity);
      expect(world.hasComponent(entity, Acting)).toBe(false);

      expect(() => adapter.onBeforeActorAct(99999)).not.toThrow();
    });

    it('deductActionCost, onAfterActorAct, refundActionCost, and clearActionAborted are safe on non-existent entities', () => {
      expect(() => adapter.deductActionCost(99999, 1000)).not.toThrow();
      expect(() => adapter.onAfterActorAct(99999)).not.toThrow();
      expect(() => adapter.refundActionCost(99999, 1000)).not.toThrow();
      expect(() => adapter.clearActionAborted(99999)).not.toThrow();
      expect(adapter.wasActionAborted(99999)).toBe(false);
      expect(adapter.isPrimaryActor(99999)).toBe(false);
      expect(adapter.getActionCost(99999, 'MOVE')).toBe(1000);
    });
  });
});
