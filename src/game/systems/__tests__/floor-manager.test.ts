import { describe, it, expect, beforeEach, vi } from 'vitest';
import { World } from '@engine/ecs/world';
import { Grid } from '@engine/grid/grid';
import { EventBus } from '@engine/events/event-bus';
import { GameplayEvents } from '@shared/events/types';
import {
  Actor,
  Position,
  FloorState,
  DescentIntent,
  Dying,
  FirmwareSlots,
  AugmentSlots,
  SoftwareSlots,
  RunInventory,
  FloorTransitioned,
} from '@shared/components';
import { createFloorManagerSystem } from '../floor-manager';
import { Phase } from '@engine/ecs/types';

describe('FloorManagerSystem Unit Tests', () => {
  let world: World<GameplayEvents>;
  let grid: Grid;
  let eventBus: EventBus<GameplayEvents>;
  let playerId: number;

  const dummyEntityFactory = {
    create: vi.fn(() => 999),
  } as any;

  const dummyComponentRegistry = {
    get: vi.fn(),
    has: vi.fn(),
  } as any;

  beforeEach(() => {
    eventBus = new EventBus<GameplayEvents>();
    world = new World<GameplayEvents>(eventBus);
    grid = new Grid(40, 40);

    // Setup player
    playerId = world.createEntity();
    world.addComponent(playerId, Actor, { isPlayer: true });
    world.addComponent(playerId, Position, { x: 5, y: 5 });
    world.addComponent(playerId, FloorState, {
      currentFloor: 1,
      maxFloor: 15,
      runSeed: 'test-seed-123',
    });
    grid.addEntity(playerId, 5, 5);
  });

  it('preserves player and equipped loadout while marking non-protected entities as Dying', () => {
    const floorTransitionHandler = vi.fn();
    eventBus.on('FLOOR_TRANSITION', floorTransitionHandler);

    // Equip player with items
    const fwItem = world.createEntity();
    const augItem = world.createEntity();
    const swItem = world.createEntity();
    const invItem = world.createEntity();

    world.addComponent(playerId, FirmwareSlots, { equipped: [fwItem] });
    world.addComponent(playerId, AugmentSlots, { equipped: [augItem] });
    world.addComponent(playerId, SoftwareSlots, {
      maxSlots: 3,
      allowedTypes: ['software'],
      equipped: [swItem],
    });
    world.addComponent(playerId, RunInventory, {
      software: [
        {
          entityId: invItem,
          templateId: 'vampire-v1',
          rarityTier: 'common',
          pickedUpAtFloor: 1,
          pickedUpAtTimestamp: 1000,
        },
      ],
      equipment: [],
      maxSlots: 5,
    });

    // Spawn an enemy that should NOT survive the transition
    const enemy = world.createEntity();
    world.addComponent(enemy, Actor, { isPlayer: false });
    world.addComponent(enemy, Position, { x: 10, y: 10 });
    grid.addEntity(enemy, 10, 10);

    const floorManager = createFloorManagerSystem(
      world,
      grid,
      eventBus,
      dummyEntityFactory,
      dummyComponentRegistry,
      false, // isClient = false (server mode)
    );
    floorManager.init();

    // Trigger descent to Floor 2
    world.addComponent(playerId, DescentIntent, { targetFloor: 2, cost: 0 });

    world.executeSystems(Phase.CLEANUP);
    eventBus.flush();

    // Enemy must be marked as Dying
    expect(world.hasComponent(enemy, Dying)).toBe(true);

    // Player and all equipment must NOT be marked Dying
    expect(world.hasComponent(playerId, Dying)).toBe(false);
    expect(world.hasComponent(fwItem, Dying)).toBe(false);
    expect(world.hasComponent(augItem, Dying)).toBe(false);
    expect(world.hasComponent(swItem, Dying)).toBe(false);
    expect(world.hasComponent(invItem, Dying)).toBe(false);

    // Floor state must update to Floor 2
    const floorState = world.getComponent(playerId, FloorState);
    expect(floorState?.currentFloor).toBe(2);

    // Tag component FloorTransitioned must be added
    expect(world.hasComponent(playerId, FloorTransitioned)).toBe(true);

    // FLOOR_TRANSITION event must be emitted
    expect(floorTransitionHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        floorNumber: 2,
        depthBand: expect.any(String),
      }),
    );
  });

  it('skips dungeon regeneration when running on client (isClient = true)', () => {
    const floorManager = createFloorManagerSystem(
      world,
      grid,
      eventBus,
      dummyEntityFactory,
      dummyComponentRegistry,
      true, // isClient = true
    );
    floorManager.init();

    world.addComponent(playerId, DescentIntent, { targetFloor: 2, cost: 0 });

    world.executeSystems(Phase.CLEANUP);

    // On client, floor manager should not regenerate dungeon or purge entities locally
    const floorState = world.getComponent(playerId, FloorState);
    expect(floorState?.currentFloor).toBe(1); // unchanged on client
  });
});
