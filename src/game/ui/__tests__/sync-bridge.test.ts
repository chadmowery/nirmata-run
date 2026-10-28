import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { syncEngineToStore } from '../sync-bridge';
import { gameStore } from '../store';
import { GameState } from '../../states/types';
import { World } from '@engine/ecs/world';
import { Grid } from '@engine/grid/grid';
import { EventBus } from '@engine/events/event-bus';
import { GameplayEvents } from '@shared/events/types';
import {
  Actor,
  Health,
  Heat,
  Stability,
  FloorState,
  Progression,
  RunCurrency,
  RunInventory,
} from '@shared/components';
import { GameContext } from '../../types';

describe('SyncBridge: Engine to Zustand Store Projection', () => {
  let world: World<GameplayEvents>;
  let grid: Grid;
  let eventBus: EventBus<GameplayEvents>;
  let context: GameContext;
  let playerId: number;

  beforeEach(() => {
    // Reset Zustand store
    gameStore.setState({
      player: {
        hp: 0,
        maxHp: 0,
        xp: 0,
        level: 1,
        statuses: [],
        heat: 0,
        maxHeat: 100,
        shellName: 'None',
        mods: [],
      },
      messages: [],
      gameStatus: GameState.Playing,
      visibleEntities: [],
      stability: 100,
      maxStability: 100,
      scrap: 0,
      currentFloor: 1,
      depthBand: 'Unknown',
      anchorOverlayVisible: false,
      anchorData: null,
      staircaseOverlayVisible: false,
      staircaseData: null,
    });

    eventBus = new EventBus<GameplayEvents>();
    world = new World<GameplayEvents>(eventBus);
    grid = new Grid(10, 10);

    playerId = world.createEntity();
    world.addComponent(playerId, Actor, { isPlayer: true });
    world.addComponent(playerId, Health, { current: 25, max: 50, isAlive: true });
    world.addComponent(playerId, Heat, {
      current: 40,
      maxSafe: 100,
      baseDissipation: 5,
      ventPercentage: 0.5,
      isVenting: false,
    });
    world.addComponent(playerId, Stability, { current: 80, max: 100 });
    world.addComponent(playerId, FloorState, { currentFloor: 3, maxFloor: 15, runSeed: 'seed' });
    world.addComponent(playerId, Progression, { xp: 150, level: 2 });
    world.addComponent(playerId, RunCurrency, {
      stacks: [{ currencyType: 'scrap', amount: 75 }],
    });
    world.addComponent(playerId, RunInventory, {
      software: [],
      equipment: [],
      maxSlots: 5,
    });

    context = {
      world: world as any,
      grid,
      eventBus: eventBus as any,
      playerId,
      fsm: { transition: vi.fn() } as any,
      turnManager: {} as any,
    } as unknown as GameContext;

    syncEngineToStore(context);
  });

  it('projects initial ECS component state into Zustand store upon synchronization', () => {
    const state = gameStore.getState();

    expect(state.player.hp).toBe(25);
    expect(state.player.maxHp).toBe(50);
    expect(state.player.heat).toBe(40);
    expect(state.player.maxHeat).toBe(100);
    expect(state.player.xp).toBe(150);
    expect(state.player.level).toBe(2);
    expect(state.stability).toBe(80);
    expect(state.maxStability).toBe(100);
    expect(state.scrap).toBe(75);
    expect(state.currentFloor).toBe(3);
    expect(state.depthBand).toBe('CORRUPTED_DATA');
  });

  it('reacts to DAMAGE_DEALT and refreshes player stats', () => {
    // Player takes damage in ECS
    world.patchComponent(playerId, Health, { current: 15 });

    eventBus.emit('DAMAGE_DEALT', {
      attackerId: 99,
      defenderId: playerId,
      amount: 10,
    });
    eventBus.flush();

    expect(gameStore.getState().player.hp).toBe(15);
  });

  it('reacts to STABILITY_CHANGED and updates store stability', () => {
    world.patchComponent(playerId, Stability, { current: 65 });

    eventBus.emit('STABILITY_CHANGED', {
      entityId: playerId,
      oldValue: 80,
      newValue: 65,
      reason: 'floor_entry',
    } as any);
    eventBus.flush();

    expect(gameStore.getState().stability).toBe(65);
  });

  it('reacts to ANCHOR_INTERACTION and sets modal payload in store', () => {
    const modalPayload = {
      entityId: playerId,
      anchorId: 10,
      floorNumber: 5,
      stabilityPercent: 85,
      inventory: {
        firmware: ['Laser.exe'],
        augments: ['Plating'],
        software: [],
        scrap: 200,
      },
      descendCost: 15,
      nextFloorEnemyTier: 'Tier 2',
      estimatedStabilityAfterDescent: 75,
    };

    eventBus.emit('ANCHOR_INTERACTION', modalPayload as any);
    eventBus.flush();

    expect(gameStore.getState().anchorOverlayVisible).toBe(true);
    expect(gameStore.getState().anchorData).toEqual(
      expect.objectContaining({
        anchorId: 10,
        floorNumber: 5,
        stabilityPercent: 85,
      }),
    );
  });

  it('reacts to STAIRCASE_INTERACTION and sets staircase modal in store', () => {
    eventBus.emit('STAIRCASE_INTERACTION', {
      entityId: playerId,
      staircaseId: 11,
      targetFloor: 4,
    } as any);
    eventBus.flush();

    expect(gameStore.getState().staircaseOverlayVisible).toBe(true);
    expect(gameStore.getState().staircaseData).toEqual({
      staircaseId: 11,
      targetFloor: 4,
    });
  });

  it('reacts to RUN_ENDED, calculates score, and transitions gameStatus to GameOver', () => {
    eventBus.emit('RUN_ENDED', {
      reason: 'death',
      floorNumber: 4,
      stats: {
        scrapExtracted: 100,
        fluxExtracted: 20,
        softwareExtracted: 2,
        pityAwarded: true,
        itemsExtracted: [],
      },
      entityId: playerId,
    });
    eventBus.flush();

    expect(gameStore.getState().gameStatus).toBe(GameState.GameOver);
  });
});
