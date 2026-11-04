import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '@engine/ecs/world';
import { Grid } from '@engine/grid/grid';
import { EventBus } from '@engine/events/event-bus';
import { GameplayEvents } from '@shared/events/types';
import {
  FloorState,
  Actor,
  Position,
  Prop,
  SecurityLock,
  InteractPropIntent,
  Heat,
} from '@shared/components';
import { calculateScore } from '../../src/game/scoring';
import { createPropInteractionSystem } from '../../src/game/systems/prop-interaction';

describe('M2: vaultsBreached Scoring & Key Unlocking', () => {
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
    world.addComponent(playerId, Heat, {
      current: 0,
      maxSafe: 100,
      baseDissipation: 5,
      ventPercentage: 0.5,
      isVenting: false,
    });
    world.addComponent(playerId, FloorState, {
      currentFloor: 6,
      maxFloor: 15,
      runSeed: 'seed-m2',
      accessKeysHeld: 1,
      vaultsBreached: 0,
    });
  });

  it('increments vaultsBreached when unlocking a SecurityLock with an access key', () => {
    const propId = world.createEntity();
    world.addComponent(propId, Prop, {
      propId: 'prop_vault_1',
      faction: 'cyberacme',
      propClass: 'vault_door',
      isSearched: false,
    });
    world.addComponent(propId, Position, { x: 5, y: 6 });
    world.addComponent(propId, SecurityLock, { isLocked: true });

    const propSystem = createPropInteractionSystem(world, grid, eventBus);
    propSystem.init();

    world.addComponent(playerId, InteractPropIntent, {
      targetPropId: propId,
      forceOverride: false,
    });

    propSystem.update(world);

    const floorState = world.getComponent(playerId, FloorState)!;
    expect(floorState.vaultsBreached).toBe(1);
    expect(world.getComponent(propId, SecurityLock)!.isLocked).toBe(false);
  });

  it('increments vaultsBreached when unlocking via overclock bypass', () => {
    // Zero keys
    world.patchComponent(playerId, FloorState, { accessKeysHeld: 0, vaultsBreached: 0 });

    const propId = world.createEntity();
    world.addComponent(propId, Prop, {
      propId: 'prop_vault_2',
      faction: 'cyberacme',
      propClass: 'vault_door',
      isSearched: false,
    });
    world.addComponent(propId, Position, { x: 5, y: 6 });
    world.addComponent(propId, SecurityLock, { isLocked: true, overclockHeatCost: 20 });

    const propSystem = createPropInteractionSystem(world, grid, eventBus);
    propSystem.init();

    world.addComponent(playerId, InteractPropIntent, {
      targetPropId: propId,
      forceOverride: true,
    });

    propSystem.update(world);

    const floorState = world.getComponent(playerId, FloorState)!;
    expect(floorState.vaultsBreached).toBe(1);
    expect(world.getComponent(propId, SecurityLock)!.isLocked).toBe(false);
  });

  it('calculates score with +150 per vaultsBreached', () => {
    const baseScore = calculateScore({
      floorNumber: 5,
      scrapExtracted: 100,
      softwareExtracted: 2,
      fluxExtracted: 10,
    });

    const scoreWithVaults = calculateScore({
      floorNumber: 5,
      scrapExtracted: 100,
      softwareExtracted: 2,
      fluxExtracted: 10,
      vaultsBreached: 2,
    });

    // 2 vaults * 150 = 300
    expect(scoreWithVaults - baseScore).toBe(300);
  });
});
