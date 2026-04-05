import { World } from '@engine/ecs/world';
import { EventBus } from '@engine/events/event-bus';
import { EntityId } from '@engine/ecs/types';
import { Stability, StabilityData } from '@shared/components/stability';
import { Health, HealthData } from '@shared/components/health';
import { Actor } from '@shared/components/actor';
import { GameplayEvents } from '@shared/events/types';
import { EventOriginContext } from '@shared/utils/event-context';

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

    stability.current = Math.max(0, stability.current - chunk);
    const newValue = stability.current;

    eventBus.emit('STABILITY_CHANGED', {
      entityId,
      oldValue,
      newValue,
      reason: 'floor_entry'
    } as unknown as T['STABILITY_CHANGED']);

    if (newValue === 0 && oldValue > 0) {
      eventBus.emit('STABILITY_ZERO', { entityId } as unknown as T['STABILITY_ZERO']);
    }
  };

  /**
   * Applies the per-turn stability bleed.
   */
  const applyTurnBleed = (entityId: EntityId, floorNumber: number) => {
    const stability = world.getComponent<StabilityData>(entityId, Stability);
    if (!stability) return;

    const oldValue = stability.current;
    const bleed = config.perTurnBleedBase + (floorNumber - 1) * config.perTurnBleedScale;

    stability.current = Math.max(0, stability.current - bleed);
    const newValue = stability.current;

    eventBus.emit('STABILITY_CHANGED', {
      entityId,
      oldValue,
      newValue,
      reason: 'turn_bleed'
    } as unknown as T['STABILITY_CHANGED']);

    if (newValue === 0 && oldValue > 0) {
      eventBus.emit('STABILITY_ZERO', { entityId } as unknown as T['STABILITY_ZERO']);
    }
  };

  /**
   * Deals damage to an entity if their stability is at zero.
   */
  const applyDegradedDamage = (entityId: EntityId) => {
    const stability = world.getComponent<StabilityData>(entityId, Stability);
    const health = world.getComponent<HealthData>(entityId, Health);

    if (!stability || !health || stability.current > 0) return;

    health.current = Math.max(0, health.current - config.degradedDamagePerTurn);

    eventBus.emit('DEGRADED_DAMAGE', {
      entityId,
      damage: config.degradedDamagePerTurn
    } as unknown as T['DEGRADED_DAMAGE']);

    if (health.current === 0) {
      const actor = world.getComponent(entityId, Actor);
      eventBus.emit('ENTITY_DIED', {
        entityId,
        killerId: entityId,
        isPlayer: !!actor?.isPlayer
      });
    }
  };

  /** Initialize system listeners. */
  const init = () => {
    // Listen for floor transitions
    eventBus.on('FLOOR_TRANSITION', (payload) => {
      if (EventOriginContext.current === 'server') return;
      // Find the player entity
      const players = world.query(Stability);
      for (const playerId of players) {
        applyFloorDrain(playerId, payload.floorNumber);
      }
    });

    // Listen for player actions/turns
    eventBus.on('PLAYER_ACTION', (payload) => {
      if (EventOriginContext.current === 'server') return;
      // We'll need a way to get the current floor number.
      // For now, we might need to store it or get it from somewhere.
      // Assuming we can find an entity with FloorState or something similar.
      // Or just pass a default for now and refine later.
      const floorNumber = 1; // TODO: Get actual floor number
      applyTurnBleed(payload.entityId, floorNumber);
      applyDegradedDamage(payload.entityId);
    });
  };

  return {
    init,
    applyFloorDrain,
    applyTurnBleed,
    applyDegradedDamage
  };
}

export type StabilitySystem = ReturnType<typeof createStabilitySystem>;
