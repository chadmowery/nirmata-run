import { describe, it, expect } from 'vitest';
import {
  TileOrientation,
  AutotileState,
  DirectionalProp,
  vectorToOrientation,
  orientationToAngleDegrees,
  orientationToAngleRadians,
  ORIENTATION_VECTORS,
  OPPOSITE_ORIENTATION,
} from '../environment';
import { World } from '@engine/ecs/world';
import { EventBus } from '@engine/events/event-bus';
import { GameplayEvents } from '@shared/events/types';
import { serializeWorld, deserializeWorld } from '../../serialization';

describe('Directional Environment Components & Utilities (Milestone 1)', () => {
  it('validates vectorToOrientation according to mathematical spec', () => {
    // NORTH: dy < 0 and |dy| >= |dx|
    expect(vectorToOrientation(0, -1)).toBe('NORTH');
    expect(vectorToOrientation(1, -2)).toBe('NORTH');
    expect(vectorToOrientation(-1, -1)).toBe('NORTH');

    // EAST: dx > 0 and |dx| > |dy|
    expect(vectorToOrientation(1, 0)).toBe('EAST');
    expect(vectorToOrientation(2, 1)).toBe('EAST');
    expect(vectorToOrientation(2, -1)).toBe('EAST');

    // SOUTH: dy > 0 and |dy| >= |dx|
    expect(vectorToOrientation(0, 1)).toBe('SOUTH');
    expect(vectorToOrientation(1, 2)).toBe('SOUTH');
    expect(vectorToOrientation(1, 1)).toBe('SOUTH');

    // WEST: dx < 0 and |dx| > |dy|
    expect(vectorToOrientation(-1, 0)).toBe('WEST');
    expect(vectorToOrientation(-2, 1)).toBe('WEST');
    expect(vectorToOrientation(-2, -1)).toBe('WEST');
  });

  it('correctly provides angle degrees and radians', () => {
    expect(orientationToAngleDegrees('NORTH')).toBe(0);
    expect(orientationToAngleDegrees('EAST')).toBe(90);
    expect(orientationToAngleDegrees('SOUTH')).toBe(180);
    expect(orientationToAngleDegrees('WEST')).toBe(270);

    expect(orientationToAngleRadians('NORTH')).toBeCloseTo(0);
    expect(orientationToAngleRadians('EAST')).toBeCloseTo(Math.PI / 2);
    expect(orientationToAngleRadians('SOUTH')).toBeCloseTo(Math.PI);
    expect(orientationToAngleRadians('WEST')).toBeCloseTo((3 * Math.PI) / 2);
  });

  it('provides orientation vectors and opposite orientations', () => {
    expect(ORIENTATION_VECTORS.NORTH).toEqual({ x: 0, y: -1 });
    expect(ORIENTATION_VECTORS.EAST).toEqual({ x: 1, y: 0 });
    expect(ORIENTATION_VECTORS.SOUTH).toEqual({ x: 0, y: 1 });
    expect(ORIENTATION_VECTORS.WEST).toEqual({ x: -1, y: 0 });

    expect(OPPOSITE_ORIENTATION.NORTH).toBe('SOUTH');
    expect(OPPOSITE_ORIENTATION.EAST).toBe('WEST');
    expect(OPPOSITE_ORIENTATION.SOUTH).toBe('NORTH');
    expect(OPPOSITE_ORIENTATION.WEST).toBe('EAST');
  });

  it('attaches and queries TileOrientation, AutotileState, and DirectionalProp in an ECS World', () => {
    const eventBus = new EventBus<GameplayEvents>();
    const world = new World(eventBus);
    const entityId = world.createEntity();

    world.addComponent(entityId, TileOrientation, {
      facing: 'EAST',
      angleDegrees: 90,
      isRotatable: true,
    });

    world.addComponent(entityId, AutotileState, {
      bitmask: 5,
      tileClass: 'straight',
      resolvedFrameKey: 'wall_straight_v',
    });

    world.addComponent(entityId, DirectionalProp, {
      requiresFrontAccess: true,
      frontFacingVector: { x: 0, y: 1 },
      hasDirectionalCover: true,
      coverArcDegrees: 180,
    });

    const orientation = world.getComponent(entityId, TileOrientation);
    expect(orientation).toBeDefined();
    expect(orientation?.facing).toBe('EAST');
    expect(orientation?.angleDegrees).toBe(90);
    expect(orientation?.isRotatable).toBe(true);

    const autotile = world.getComponent(entityId, AutotileState);
    expect(autotile).toBeDefined();
    expect(autotile?.bitmask).toBe(5);
    expect(autotile?.tileClass).toBe('straight');
    expect(autotile?.resolvedFrameKey).toBe('wall_straight_v');

    const prop = world.getComponent(entityId, DirectionalProp);
    expect(prop).toBeDefined();
    expect(prop?.requiresFrontAccess).toBe(true);
    expect(prop?.frontFacingVector).toEqual({ x: 0, y: 1 });
    expect(prop?.hasDirectionalCover).toBe(true);
    expect(prop?.coverArcDegrees).toBe(180);
  });

  it('uses default values for schemas when parsed with empty objects', () => {
    const orientation = TileOrientation.schema.parse({});
    expect(orientation.facing).toBe('NORTH');
    expect(orientation.angleDegrees).toBe(0);
    expect(orientation.isRotatable).toBe(false);

    const autotile = AutotileState.schema.parse({});
    expect(autotile.bitmask).toBe(0);
    expect(autotile.tileClass).toBe('pillar');
    expect(autotile.resolvedFrameKey).toBe('wall_pillar');

    const prop = DirectionalProp.schema.parse({});
    expect(prop.requiresFrontAccess).toBe(true);
    expect(prop.frontFacingVector).toEqual({ x: 0, y: 1 });
    expect(prop.hasDirectionalCover).toBe(true);
    expect(prop.coverArcDegrees).toBe(180);
  });

  it('serializes and deserializes directional components cleanly via serializeWorld/deserializeWorld', () => {
    const eventBus = new EventBus<GameplayEvents>();
    const world = new World(eventBus);
    const entityId = world.createEntity();

    world.addComponent(entityId, TileOrientation, {
      facing: 'WEST',
      angleDegrees: 270,
      isRotatable: true,
    });
    world.addComponent(entityId, AutotileState, {
      bitmask: 8,
      tileClass: 'cap',
      resolvedFrameKey: 'wall_cap_e',
    });
    world.addComponent(entityId, DirectionalProp, {
      requiresFrontAccess: true,
      frontFacingVector: { x: -1, y: 0 },
      hasDirectionalCover: true,
      coverArcDegrees: 180,
    });

    const serialized = serializeWorld(world);
    const newWorld = deserializeWorld(serialized, new EventBus<GameplayEvents>());

    expect(newWorld.entityExists(entityId)).toBe(true);
    const orientation = newWorld.getComponent(entityId, TileOrientation);
    expect(orientation).toEqual({
      facing: 'WEST',
      angleDegrees: 270,
      isRotatable: true,
    });

    const autotile = newWorld.getComponent(entityId, AutotileState);
    expect(autotile).toEqual({
      bitmask: 8,
      tileClass: 'cap',
      resolvedFrameKey: 'wall_cap_e',
    });

    const prop = newWorld.getComponent(entityId, DirectionalProp);
    expect(prop).toEqual({
      requiresFrontAccess: true,
      frontFacingVector: { x: -1, y: 0 },
      hasDirectionalCover: true,
      coverArcDegrees: 180,
    });
  });
});
