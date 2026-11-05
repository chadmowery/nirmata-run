import { describe, it, expect } from 'vitest';
import { World } from '@engine/ecs/world';
import { Grid } from '@engine/grid/grid';
import { EventBus } from '@engine/events/event-bus';
import { GameplayEvents } from '@shared/events/types';
import { Position } from '@shared/components/position';
import { Actor } from '@shared/components/actor';
import { Health } from '@shared/components/health';
import { BlocksMovement } from '@shared/components/blocks-movement';
import { MoveIntent, ActionAbortedTag } from '@shared/components/intents';
import {
  Prop,
  InteractiveSurface,
  DirectionalProp,
  TileOrientation,
  InteractPropIntent,
} from '@shared/components/environment';
import { createMovementSystem } from '../movement';
import { createPropInteractionSystem } from '../prop-interaction';
import { checkDirectionalCover } from '../combat';

describe('Milestone 3: Directional Props & Cover Mechanics', () => {
  describe('MovementSystem Front-Facing Safeguard', () => {
    it('allows interaction when player bumps into the front panel of a directional workstation', () => {
      const eventBus = new EventBus<GameplayEvents>();
      const world = new World(eventBus);
      const grid = new Grid(5, 5);

      for (let y = 0; y < 5; y++) {
        for (let x = 0; x < 5; x++) {
          grid.setTile(x, y, { terrain: 'floor', walkable: true, transparent: true });
        }
      }

      // Workstation at (2, 2) facing SOUTH (+Y). Front interface is at (2, 3).
      const propId = world.createEntity();
      world.addComponent(propId, Position, { x: 2, y: 2 });
      world.addComponent(propId, Prop, { propId: 'ws_01', faction: 'cyberacme', propClass: 'workstation' });
      world.addComponent(propId, BlocksMovement, {});
      world.addComponent(propId, TileOrientation, { facing: 'SOUTH', angleDegrees: 180, isRotatable: false });
      world.addComponent(propId, DirectionalProp, {
        requiresFrontAccess: true,
        frontFacingVector: { x: 0, y: 1 },
        hasDirectionalCover: true,
        coverArcDegrees: 180,
      });
      grid.addEntity(propId, 2, 2);

      // Player at (2, 3), bumping North (0, -1) into workstation at (2, 2)
      const playerId = world.createEntity();
      world.addComponent(playerId, Position, { x: 2, y: 3 });
      world.addComponent(playerId, Actor, { isPlayer: true });
      world.addComponent(playerId, MoveIntent, { dx: 0, dy: -1 });
      grid.addEntity(playerId, 2, 3);

      const movementSystem = createMovementSystem(world, grid, eventBus, false);
      movementSystem.update(world);

      // Should convert to InteractPropIntent and NOT attach ActionAbortedTag
      expect(world.hasComponent(playerId, ActionAbortedTag)).toBe(false);
      expect(world.hasComponent(playerId, InteractPropIntent)).toBe(true);
      const intent = world.getComponent(playerId, InteractPropIntent);
      expect(intent?.targetPropId).toBe(propId);
    });

    it('halts movement at 0 cost and displays interface notice when bumping from the side or rear', () => {
      const eventBus = new EventBus<GameplayEvents>();
      const world = new World(eventBus);
      const grid = new Grid(5, 5);

      for (let y = 0; y < 5; y++) {
        for (let x = 0; x < 5; x++) {
          grid.setTile(x, y, { terrain: 'floor', walkable: true, transparent: true });
        }
      }

      // Workstation at (2, 2) facing SOUTH (+Y). Front interface is at (2, 3).
      const propId = world.createEntity();
      world.addComponent(propId, Position, { x: 2, y: 2 });
      world.addComponent(propId, Prop, { propId: 'ws_01', faction: 'cyberacme', propClass: 'workstation' });
      world.addComponent(propId, BlocksMovement, {});
      world.addComponent(propId, TileOrientation, { facing: 'SOUTH', angleDegrees: 180, isRotatable: false });
      world.addComponent(propId, DirectionalProp, {
        requiresFrontAccess: true,
        frontFacingVector: { x: 0, y: 1 },
        hasDirectionalCover: true,
        coverArcDegrees: 180,
      });
      grid.addEntity(propId, 2, 2);

      // Player at (1, 2) (West of workstation), bumping East (+1, 0) into workstation side
      const playerId = world.createEntity();
      world.addComponent(playerId, Position, { x: 1, y: 2 });
      world.addComponent(playerId, Actor, { isPlayer: true });
      world.addComponent(playerId, MoveIntent, { dx: 1, dy: 0 });
      grid.addEntity(playerId, 1, 2);

      const emittedMessages: string[] = [];
      eventBus.on('MESSAGE_EMITTED', (payload) => {
        emittedMessages.push(payload.text);
      });

      let bufferCleared = false;
      eventBus.on('INPUT_BUFFER_CLEARED', () => {
        bufferCleared = true;
      });

      const movementSystem = createMovementSystem(world, grid, eventBus, false);
      movementSystem.update(world);
      eventBus.flush();

      // Must abort movement with 0 turn cost and clear buffer
      expect(world.hasComponent(playerId, ActionAbortedTag)).toBe(true);
      expect(world.hasComponent(playerId, InteractPropIntent)).toBe(false);
      expect(bufferCleared).toBe(true);
      expect(emittedMessages).toContain('[NOTICE] WORKSTATION FRONT INTERFACE IS TO THE SOUTH.');

      // Position must remain unchanged at (1, 2)
      const pPos = world.getComponent(playerId, Position);
      expect(pPos?.x).toBe(1);
      expect(pPos?.y).toBe(2);
    });
  });

  describe('PropInteractionSystem Front-Facing Validation', () => {
    it('rejects interaction from side and emits warning message', () => {
      const eventBus = new EventBus<GameplayEvents>();
      const world = new World(eventBus);
      const grid = new Grid(5, 5);

      const propId = world.createEntity();
      world.addComponent(propId, Position, { x: 2, y: 2 });
      world.addComponent(propId, Prop, { propId: 'locker_01', faction: 'traxus', propClass: 'locker' });
      world.addComponent(propId, DirectionalProp, {
        requiresFrontAccess: true,
        frontFacingVector: { x: 1, y: 0 }, // Facing East (+X). Front interface at (3, 2).
        hasDirectionalCover: true,
        coverArcDegrees: 180,
      });

      // Player at (2, 1) (North of locker), trying to interact directly
      const playerId = world.createEntity();
      world.addComponent(playerId, Position, { x: 2, y: 1 });
      world.addComponent(playerId, Actor, { isPlayer: true });
      world.addComponent(playerId, InteractPropIntent, { targetPropId: propId });

      const emittedMessages: string[] = [];
      eventBus.on('MESSAGE_EMITTED', (payload) => {
        emittedMessages.push(payload.text);
      });

      const propSystem = createPropInteractionSystem(world, grid, eventBus);
      propSystem.update(world);
      eventBus.flush();

      expect(emittedMessages).toContain('[NOTICE] LOCKER FRONT INTERFACE IS TO THE EAST.');
      // Intent was consumed/removed without executing loot
      expect(world.hasComponent(playerId, InteractPropIntent)).toBe(false);
    });
  });

  describe('CombatSystem Directional Cover Calculations', () => {
    it('applies cover mitigation when attacker fires into the front/forward arc of cover', () => {
      const eventBus = new EventBus<GameplayEvents>();
      const world = new World(eventBus);
      const grid = new Grid(10, 10);

      // Attacker at (5, 1) [North]
      const attackerId = world.createEntity();
      world.addComponent(attackerId, Position, { x: 5, y: 1 });
      world.addComponent(attackerId, Actor, { isPlayer: false });

      // Defender at (5, 5) [South]
      const defenderId = world.createEntity();
      world.addComponent(defenderId, Position, { x: 5, y: 5 });
      world.addComponent(defenderId, Actor, { isPlayer: true });
      world.addComponent(defenderId, Health, { max: 100, current: 100, isAlive: true });

      // Intervening cover at (5, 4) facing NORTH (cover normal points North towards attacker: { x: 0, y: -1 })
      const coverId = world.createEntity();
      world.addComponent(coverId, Position, { x: 5, y: 4 });
      world.addComponent(coverId, InteractiveSurface, {
        surfaceId: 'crate_01',
        providesCover: true,
        coverDamageReduction: 0.25,
      });
      world.addComponent(coverId, TileOrientation, { facing: 'NORTH', angleDegrees: 0, isRotatable: false });
      world.addComponent(coverId, DirectionalProp, {
        requiresFrontAccess: false,
        frontFacingVector: { x: 0, y: -1 },
        hasDirectionalCover: true,
        coverArcDegrees: 180,
      });
      grid.addEntity(coverId, 5, 4);

      const coverResult = checkDirectionalCover(world, attackerId, defenderId, grid);
      expect(coverResult.hasCover).toBe(true);
      expect(coverResult.reduction).toBe(0.25);
      expect(coverResult.coverId).toBe(coverId);
    });

    it('bypasses cover mitigation when attacker flanks from rear or unprotected side', () => {
      const eventBus = new EventBus<GameplayEvents>();
      const world = new World(eventBus);
      const grid = new Grid(10, 10);

      // Attacker at (5, 8) [South of defender]
      const attackerId = world.createEntity();
      world.addComponent(attackerId, Position, { x: 5, y: 8 });
      world.addComponent(attackerId, Actor, { isPlayer: false });

      // Defender at (5, 5) [North of attacker]
      const defenderId = world.createEntity();
      world.addComponent(defenderId, Position, { x: 5, y: 5 });
      world.addComponent(defenderId, Actor, { isPlayer: true });
      world.addComponent(defenderId, Health, { max: 100, current: 100, isAlive: true });

      // Intervening cover at (5, 4) facing NORTH
      // The attacker is at (5, 8), firing North at defender at (5, 5).
      // The threat vector towards attacker is (0, +3). Cover normal is (0, -1).
      // dot product = (0)(0) + (3)(-1) = -3 <= 0 -> Rear flank bypass!
      const coverId = world.createEntity();
      world.addComponent(coverId, Position, { x: 5, y: 4 });
      world.addComponent(coverId, InteractiveSurface, {
        surfaceId: 'crate_01',
        providesCover: true,
        coverDamageReduction: 0.25,
      });
      world.addComponent(coverId, TileOrientation, { facing: 'NORTH', angleDegrees: 0, isRotatable: false });
      world.addComponent(coverId, DirectionalProp, {
        requiresFrontAccess: false,
        frontFacingVector: { x: 0, y: -1 },
        hasDirectionalCover: true,
        coverArcDegrees: 180,
      });
      grid.addEntity(coverId, 5, 4);

      const coverResult = checkDirectionalCover(world, attackerId, defenderId, grid);
      expect(coverResult.hasCover).toBe(false);
      expect(coverResult.reduction).toBe(0);
    });
  });
});
