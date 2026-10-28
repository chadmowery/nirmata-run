import { describe, it, expect, beforeEach, vi } from 'vitest';
import { World } from '@engine/ecs/world';
import { EventBus } from '@engine/events/event-bus';
import { GameplayEvents } from '@shared/events/types';
import {
  Stability,
  Health,
  FloorState,
  FloorTransitioned,
  DamageIntent,
} from '@shared/components';
import { createStabilitySystem, DEFAULT_STABILITY_CONFIG } from '../stability';
import { Phase } from '@engine/ecs/types';

describe('StabilitySystem Unit Tests', () => {
  let world: World<GameplayEvents>;
  let eventBus: EventBus<GameplayEvents>;
  let stabilitySystem: ReturnType<typeof createStabilitySystem>;
  let playerId: number;

  beforeEach(() => {
    eventBus = new EventBus<GameplayEvents>();
    world = new World<GameplayEvents>(eventBus);

    stabilitySystem = createStabilitySystem(world, eventBus, {
      ...DEFAULT_STABILITY_CONFIG,
      perFloorChunkBase: 10,
      perFloorChunkScale: 1,
      perTurnBleedBase: 1,
      perTurnBleedScale: 0.5,
      degradedDamagePerTurn: 2,
    });
    stabilitySystem.init();

    playerId = world.createEntity();
    world.addComponent(playerId, Stability, { current: 100, max: 100 });
    world.addComponent(playerId, Health, { current: 20, max: 20, isAlive: true });
    world.addComponent(playerId, FloorState, { currentFloor: 1, maxFloor: 15, runSeed: 'test' });
  });

  it('drains stability chunk upon floor transition', () => {
    const stabilityChangeHandler = vi.fn();
    eventBus.on('STABILITY_CHANGED', stabilityChangeHandler);

    // Mark that entity just transitioned to Floor 2
    world.patchComponent(playerId, FloorState, { currentFloor: 2 });
    world.addComponent(playerId, FloorTransitioned, { floorNumber: 2 });

    // Execute PRE_TURN phase
    world.executeSystems(Phase.PRE_TURN);
    eventBus.flush();

    // Floor drain: 10 + (2 - 1) * 1 = 11.
    // Turn bleed: 1 + (2 - 1) * 0.5 = 1.5.
    // Total reduction = 12.5 -> current = 87.5
    const stability = world.getComponent(playerId, Stability);
    expect(stability?.current).toBe(87.5);

    expect(stabilityChangeHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        entityId: playerId,
        reason: 'floor_entry',
      }),
    );
    expect(stabilityChangeHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        entityId: playerId,
        reason: 'turn_bleed',
      }),
    );
  });

  it('bleeds stability per turn without floor transition', () => {
    // Floor 1 bleed: 1 + (1 - 1) * 0.5 = 1.
    world.executeSystems(Phase.PRE_TURN);

    const stability = world.getComponent(playerId, Stability);
    expect(stability?.current).toBe(99);
  });

  it('applies degraded DamageIntent and emits DEGRADED_DAMAGE when stability reaches 0', () => {
    const degradedHandler = vi.fn();
    eventBus.on('DEGRADED_DAMAGE', degradedHandler);

    // Deplete stability to 0
    world.patchComponent(playerId, Stability, { current: 0 });

    world.executeSystems(Phase.PRE_TURN);
    eventBus.flush();

    // DamageIntent must be attached with 2 damage
    const damageIntent = world.getComponent(playerId, DamageIntent);
    expect(damageIntent).toBeDefined();
    expect(damageIntent?.amount).toBe(2);
    expect(damageIntent?.targetId).toBe(playerId);

    expect(degradedHandler).toHaveBeenCalledWith({
      entityId: playerId,
      damage: 2,
    });
  });

  it('does not apply degraded damage if health is already 0', () => {
    world.patchComponent(playerId, Stability, { current: 0 });
    world.patchComponent(playerId, Health, { current: 0, isAlive: false });

    world.executeSystems(Phase.PRE_TURN);

    expect(world.hasComponent(playerId, DamageIntent)).toBe(false);
  });
});
