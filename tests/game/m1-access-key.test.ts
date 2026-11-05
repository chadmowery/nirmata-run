import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '@engine/ecs/world';
import { Grid } from '@engine/grid/grid';
import { EventBus } from '@engine/events/event-bus';
import { GameplayEvents } from '@shared/events/types';
import {
  FloorState,
  RunInventory,
  Actor,
  Position,
  Prop,
  SecurityLock,
  InteractPropIntent,
} from '@shared/components';
import {
  isAccessKeyTemplate,
  playerHasAccessKey,
  consumeAccessKey,
} from '@shared/utils/access-key-util';
import { createPropInteractionSystem } from '../../src/game/systems/prop-interaction';

describe('M1: Access Key Accounting & Consumption Invariants', () => {
  let world: World<GameplayEvents>;
  let grid: Grid;
  let eventBus: EventBus<GameplayEvents>;
  let playerId: number;

  beforeEach(() => {
    eventBus = new EventBus<GameplayEvents>();
    world = new World<GameplayEvents>(eventBus);
    grid = new Grid(20, 20);

    playerId = world.createEntity();
    world.addComponent(playerId, Actor, { isPlayer: true });
    world.addComponent(playerId, Position, { x: 5, y: 5 });
    world.addComponent(playerId, FloorState, {
      currentFloor: 6,
      maxFloor: 15,
      runSeed: 'seed-m1',
      accessKeysHeld: 0,
    });
    world.addComponent(playerId, RunInventory, {
      maxSlots: 5,
      software: [],
      equipment: [],
    });
  });

  it('isAccessKeyTemplate correctly matches item-access-key templates only', () => {
    expect(isAccessKeyTemplate('item-access-key')).toBe(true);
    expect(isAccessKeyTemplate('item-access-key-v2')).toBe(true);
    expect(isAccessKeyTemplate('weapon-access-keycard')).toBe(false);
    expect(isAccessKeyTemplate('software-slice')).toBe(false);
    expect(isAccessKeyTemplate(undefined)).toBe(false);
  });

  it('correctly consumes access keys from equipment inventory and prevents infinite reuse', () => {
    // Key in equipment
    world.patchComponent(playerId, RunInventory, {
      software: [],
      equipment: [
        {
          entityId: 99,
          templateId: 'item-access-key',
          rarityTier: 'common',
          pickedUpAtFloor: 6,
          pickedUpAtTimestamp: Date.now(),
        },
      ],
    });

    expect(playerHasAccessKey(world, playerId)).toBe(true);
    const consumed1 = consumeAccessKey(world, playerId);
    expect(consumed1).toBe(true);

    // RunInventory equipment should now be empty
    const invAfter = world.getComponent(playerId, RunInventory)!;
    expect(invAfter.equipment.length).toBe(0);

    // Second consumption must fail (no infinite keys)
    expect(playerHasAccessKey(world, playerId)).toBe(false);
    const consumed2 = consumeAccessKey(world, playerId);
    expect(consumed2).toBe(false);
  });

  it('SecurityLock does not unlock if access key consumption fails', () => {
    const propId = world.createEntity();
    world.addComponent(propId, Prop, {
      propId: 'prop_safe_1',
      faction: 'cyberacme',
      propClass: 'encrypted_safe',
      isSearched: false,
    });
    world.addComponent(propId, Position, { x: 5, y: 6 });
    world.addComponent(propId, SecurityLock, {
      isLocked: true,
    });

    const propSystem = createPropInteractionSystem(world, grid, eventBus);
    propSystem.init();

    // Player has no key
    world.addComponent(playerId, InteractPropIntent, {
      targetPropId: propId,
      forceOverride: false,
    });

    propSystem.update(world);

    const lock = world.getComponent(propId, SecurityLock)!;
    expect(lock.isLocked).toBe(true);
  });
});
