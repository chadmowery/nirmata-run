import { describe, it, expect, beforeEach } from 'vitest';
import { createMovementSystem } from './movement';
import { Grid } from '@engine/grid/grid';
import { World } from '@engine/ecs/world';
import { EventBus } from '@engine/events/event-bus';
import { Position } from '@shared/components/position';
import { Hostile } from '@shared/components/hostile';
import { Actor } from '@shared/components/actor';
import { BlocksMovement } from '@shared/components/blocks-movement';
import { MoveIntent, AttackIntent } from '@shared/components/intents';
import { Prop, CorruptedNode, InteractPropIntent } from '@shared/components/environment';
import { Phase } from '@engine/ecs/types';
import { GameplayEvents } from '@shared/events/types';

describe('MovementSystem', () => {
  let world: World<GameplayEvents>;
  let grid: Grid;
  let eventBus: EventBus<GameplayEvents>;
  let movementSystem: any;

  beforeEach(() => {
    eventBus = new EventBus<GameplayEvents>();
    world = new World<GameplayEvents>(eventBus);
    grid = new Grid(10, 10);

    // Set all tiles to walkable by default for testing
    for (let y = 0; y < 10; y++) {
      for (let x = 0; x < 10; x++) {
        grid.setTile(x, y, { walkable: true });
      }
    }

    movementSystem = createMovementSystem(world, grid, eventBus);
    movementSystem.init();
  });

  it('should move entity successfully to an empty walkable tile via MoveIntent', () => {
    const playerId = world.createEntity();
    world.addComponent(playerId, Position, { x: 5, y: 5 });
    grid.addEntity(playerId, 5, 5);

    world.addComponent(playerId, MoveIntent, { dx: 1, dy: 0 });
    world.executeSystems(Phase.ACTION);

    const pos = world.getComponent(playerId, Position);
    expect(pos).toEqual({ x: 6, y: 5 });
    expect(grid.getEntitiesAt(5, 5).has(playerId)).toBe(false);
    expect(grid.getEntitiesAt(6, 5).has(playerId)).toBe(true);
    expect(world.hasComponent(playerId, MoveIntent)).toBe(false); // Should be cleared
  });

  it('should block movement if target is out of bounds', () => {
    const playerId = world.createEntity();
    world.addComponent(playerId, Position, { x: 0, y: 0 });
    grid.addEntity(playerId, 0, 0);

    world.addComponent(playerId, MoveIntent, { dx: -1, dy: 0 });
    world.executeSystems(Phase.ACTION);

    const pos = world.getComponent(playerId, Position);
    expect(pos).toEqual({ x: 0, y: 0 });
    expect(world.hasComponent(playerId, MoveIntent)).toBe(false);
  });

  it('should convert MoveIntent to AttackIntent when moving into a hostile entity', () => {
    const playerId = world.createEntity();
    world.addComponent(playerId, Actor, { isPlayer: true });
    world.addComponent(playerId, Position, { x: 5, y: 5 });
    grid.addEntity(playerId, 5, 5);

    const enemyId = world.createEntity();
    world.addComponent(enemyId, Actor, { isPlayer: false });
    world.addComponent(enemyId, Hostile, {});
    world.addComponent(enemyId, Position, { x: 6, y: 5 });
    grid.addEntity(enemyId, 6, 5);

    world.addComponent(playerId, MoveIntent, { dx: 1, dy: 0 });
    world.executeSystems(Phase.ACTION);

    // Should NOT move
    const pos = world.getComponent(playerId, Position);
    expect(pos).toEqual({ x: 5, y: 5 });

    // Should ADD AttackIntent
    const attackIntent = world.getComponent(playerId, AttackIntent);
    expect(attackIntent).toEqual({ targetId: enemyId });

    // Should CLEAR MoveIntent
    expect(world.hasComponent(playerId, MoveIntent)).toBe(false);
  });

  it('should block movement when moving into a non-hostile blocking entity', () => {
    const playerId = world.createEntity();
    world.addComponent(playerId, Position, { x: 5, y: 5 });
    grid.addEntity(playerId, 5, 5);

    const wallId = world.createEntity();
    world.addComponent(wallId, BlocksMovement, {});
    world.addComponent(wallId, Position, { x: 6, y: 5 });
    grid.addEntity(wallId, 6, 5);

    world.addComponent(playerId, MoveIntent, { dx: 1, dy: 0 });
    world.executeSystems(Phase.ACTION);

    const pos = world.getComponent(playerId, Position);
    expect(pos).toEqual({ x: 5, y: 5 });
    expect(world.hasComponent(playerId, AttackIntent)).toBe(false);
    expect(world.hasComponent(playerId, MoveIntent)).toBe(false);
  });

  it('should not be blocked by non-blocking entities (e.g. items)', () => {
    const playerId = world.createEntity();
    world.addComponent(playerId, Position, { x: 5, y: 5 });
    grid.addEntity(playerId, 5, 5);

    const itemId = world.createEntity();
    world.addComponent(itemId, Position, { x: 6, y: 5 });
    grid.addEntity(itemId, 6, 5);
    // itemId DOES NOT have BlocksMovement

    world.addComponent(playerId, MoveIntent, { dx: 1, dy: 0 });
    world.executeSystems(Phase.ACTION);

    const pos = world.getComponent(playerId, Position);
    expect(pos).toEqual({ x: 6, y: 5 });
    expect(world.hasComponent(playerId, MoveIntent)).toBe(false);
  });

  describe('Client Prediction Boundary vs Server Prop Interaction', () => {
    it('server mode attaches InteractPropIntent on bump to safe unsearched prop', () => {
      const playerId = world.createEntity();
      world.addComponent(playerId, Actor, { isPlayer: true });
      world.addComponent(playerId, Position, { x: 5, y: 5 });
      grid.addEntity(playerId, 5, 5);

      const propId = world.createEntity();
      world.addComponent(propId, Prop, { propId: 'prop-1', faction: 'system', propClass: 'locker', isSearched: false });
      world.addComponent(propId, Position, { x: 6, y: 5 });
      grid.addEntity(propId, 6, 5);

      world.addComponent(playerId, MoveIntent, { dx: 1, dy: 0 });
      world.executeSystems(Phase.ACTION);

      expect(world.getComponent(playerId, Position)).toEqual({ x: 5, y: 5 });
      expect(world.hasComponent(playerId, MoveIntent)).toBe(false);
      const interactIntent = world.getComponent(playerId, InteractPropIntent);
      expect(interactIntent).toEqual({ targetPropId: propId, forceOverride: false });
    });

    it('client mode blocks movement on bump to safe unsearched prop WITHOUT attaching InteractPropIntent', () => {
      const clientBus = new EventBus<GameplayEvents>();
      const clientWorld = new World<GameplayEvents>(clientBus);
      const clientGrid = new Grid(10, 10);
      for (let y = 0; y < 10; y++) {
        for (let x = 0; x < 10; x++) {
          clientGrid.setTile(x, y, { walkable: true });
        }
      }
      const clientMovement = createMovementSystem(clientWorld, clientGrid, clientBus, true);
      clientMovement.init();

      const playerId = clientWorld.createEntity();
      clientWorld.addComponent(playerId, Actor, { isPlayer: true });
      clientWorld.addComponent(playerId, Position, { x: 5, y: 5 });
      clientGrid.addEntity(playerId, 5, 5);

      const propId = clientWorld.createEntity();
      clientWorld.addComponent(propId, Prop, { propId: 'prop-1', faction: 'system', propClass: 'locker', isSearched: false });
      clientWorld.addComponent(propId, Position, { x: 6, y: 5 });
      clientGrid.addEntity(propId, 6, 5);

      clientWorld.addComponent(playerId, MoveIntent, { dx: 1, dy: 0 });
      clientWorld.executeSystems(Phase.ACTION);

      // Player should be blocked in prediction
      expect(clientWorld.getComponent(playerId, Position)).toEqual({ x: 5, y: 5 });
      expect(clientWorld.hasComponent(playerId, MoveIntent)).toBe(false);
      // But client must NOT attach InteractPropIntent (server-only system resolution)
      expect(clientWorld.hasComponent(playerId, InteractPropIntent)).toBe(false);
    });

    it('client mode blocks movement on corrupted prop WITHOUT emitting duplicate messages', () => {
      const clientBus = new EventBus<GameplayEvents>();
      const clientWorld = new World<GameplayEvents>(clientBus);
      const clientGrid = new Grid(10, 10);
      for (let y = 0; y < 10; y++) {
        for (let x = 0; x < 10; x++) {
          clientGrid.setTile(x, y, { walkable: true });
        }
      }
      const clientMovement = createMovementSystem(clientWorld, clientGrid, clientBus, true);
      clientMovement.init();

      const emittedMessages: any[] = [];
      clientBus.on('MESSAGE_EMITTED', (payload) => emittedMessages.push(payload));

      const playerId = clientWorld.createEntity();
      clientWorld.addComponent(playerId, Actor, { isPlayer: true });
      clientWorld.addComponent(playerId, Position, { x: 5, y: 5 });
      clientGrid.addEntity(playerId, 5, 5);

      const propId = clientWorld.createEntity();
      clientWorld.addComponent(propId, Prop, { propId: 'prop-terminal', faction: 'system', propClass: 'workstation', isSearched: false });
      clientWorld.addComponent(propId, CorruptedNode, {
        isDisarmed: false,
        triggered: false,
        trapType: 'acoustic_alert',
        revealed: false,
      });
      clientWorld.addComponent(propId, Position, { x: 6, y: 5 });
      clientGrid.addEntity(propId, 6, 5);

      clientWorld.addComponent(playerId, MoveIntent, { dx: 1, dy: 0 });
      clientWorld.executeSystems(Phase.ACTION);

      expect(clientWorld.getComponent(playerId, Position)).toEqual({ x: 5, y: 5 });
      expect(clientWorld.hasComponent(playerId, MoveIntent)).toBe(false);
      // No duplicate messages emitted from client prediction
      expect(emittedMessages).toHaveLength(0);
    });
  });
});
