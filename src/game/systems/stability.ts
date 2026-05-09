import { World } from '@engine/ecs/world';
import { EventBus } from '@engine/events/event-bus';
import { EntityId, Phase } from '@engine/ecs/types';
import { Stability, StabilityData } from '@shared/components/stability';
import { Health, HealthData } from '@shared/components/health';
import { GameplayEvents } from '@shared/events/types';
import { GameEvents } from '../events/types';
import { FloorTransitioned } from '@shared/components/floor-transitioned';
import { FloorState } from '@shared/components/floor-state';
import { DamageIntent } from '@shared/components/intents';

/**
 * Configuration for the Reality Stability system.
 * Governs the dual drain (per-floor + per-turn) and degraded state damage.
 */
export interface StabilityConfig {
  initialStability: number;      // 100
  perFloorChunkBase: number;     // 5 — base stability lost on entering a new floor
  perFloorChunkScale: number;    // 0.5 — additional per-floor scaling
  perTurnBleedBase: number;      // 0.5 — base stability lost per turn
  perTurnBleedScale: number;     // 0.1 — additional per-floor scaling
  degradedDamagePerTurn: number; // 2 — HP damage per turn when stability is 0
}

/** Default configuration values for Stability. */
export const DEFAULT_STABILITY_CONFIG: StabilityConfig = {
  initialStability: 100,
  perFloorChunkBase: 5,
  perFloorChunkScale: 0.5,
  perTurnBleedBase: 0.01,
  perTurnBleedScale: 0.1,
  degradedDamagePerTurn: 2,
};

/**
 * The StabilitySystem manages the Reality Stability of entities (primarily the player).
 * It handles stability decay over time and floor transitions, and deals damage 
 * when stability is depleted.
 */
export function createStabilitySystem<T extends GameplayEvents>(
  world: World<T>,
  eventBus: EventBus<T>,
  config: StabilityConfig = DEFAULT_STABILITY_CONFIG
) {
  /**
   * Applies the stability penalty for entering a new floor.
   */
  const applyFloorDrain = (entityId: EntityId, floorNumber: number) => {
    const stability = world.getComponent<StabilityData>(entityId, Stability);
    if (!stability) return;

    const oldValue = stability.current;
    const chunk = config.perFloorChunkBase + (floorNumber - 1) * config.perFloorChunkScale;
    const newValue = Math.max(0, stability.current - chunk);

    world.patchComponent(entityId, Stability, { current: newValue });

    eventBus.emit('STABILITY_CHANGED', {
      entityId,
      oldValue,
      newValue,
      reason: 'floor_entry'
    } as unknown as T['STABILITY_CHANGED']);
  };

  /**
   * Applies the per-turn stability bleed.
   */
  const applyTurnBleed = (entityId: EntityId, floorNumber: number) => {
    const stability = world.getComponent<StabilityData>(entityId, Stability);
    if (!stability) return;

    const oldValue = stability.current;
    const bleed = config.perTurnBleedBase + (floorNumber - 1) * config.perTurnBleedScale;
    const newValue = Math.max(0, stability.current - bleed);

    world.patchComponent(entityId, Stability, { current: newValue });

    eventBus.emit('STABILITY_CHANGED', {
      entityId,
      oldValue,
      newValue,
      reason: 'turn_bleed'
    } as unknown as T['STABILITY_CHANGED']);
  };

  /**
   * Deals damage to an entity if their stability is at zero.
   */
  const applyDegradedDamage = (entityId: EntityId) => {
    const stability = world.getComponent<StabilityData>(entityId, Stability);
    const health = world.getComponent<HealthData>(entityId, Health);

    if (!stability || !health || stability.current > 0 || health.current <= 0) return;

    // Request damage via DamageIntent instead of direct patching
    world.addComponent(entityId, DamageIntent, {
      targetId: entityId,
      amount: config.degradedDamagePerTurn
    });

    eventBus.emit('DEGRADED_DAMAGE', {
      entityId,
      damage: config.degradedDamagePerTurn
    } as unknown as T['DEGRADED_DAMAGE']);
  };

  const updatePreTurn = (w: World<T>) => {
    const entities = w.query(Stability);
    for (const entityId of entities) {
      const floorState = w.getComponent(entityId, FloorState);
      const floorNumber = floorState?.currentFloor || 1;

      // Check for floor transition
      if (w.hasComponent(entityId, FloorTransitioned)) {
        applyFloorDrain(entityId, floorNumber);
      }

      applyTurnBleed(entityId, floorNumber);
      applyDegradedDamage(entityId);
    }
  };

  /** Initialize system. */
  const init = () => {
    world.registerSystem(Phase.PRE_TURN, updatePreTurn);
  };

  return {
    init,
    dispose: () => {
      world.unregisterSystem(Phase.PRE_TURN, updatePreTurn);
    },
    update: updatePreTurn,
    applyFloorDrain,
    applyTurnBleed,
    applyDegradedDamage
  };
}

export type StabilitySystem<T extends GameplayEvents = GameEvents> = ReturnType<typeof createStabilitySystem<T>>;
