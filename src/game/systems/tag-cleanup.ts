import { World } from '@engine/ecs/world';
import { Phase } from '@engine/ecs/types';
import { MovedThisTurn, FirmwareActivatedThisTurn, DealtDamageThisTurn } from '@shared/components';
import { GameplayEvents } from '@shared/events/types';

/**
 * System that cleans up transient turn-based tags (Phase 6.4).
 */
export function createTagCleanupSystem<T extends GameplayEvents>(world: World<T>) {
  const update = (w: World<T>) => {
    const movers = w.query(MovedThisTurn);
    for (const entityId of movers) {
      w.removeComponent(entityId, MovedThisTurn);
    }

    const activated = w.query(FirmwareActivatedThisTurn);
    for (const entityId of activated) {
      w.removeComponent(entityId, FirmwareActivatedThisTurn);
    }

    const damageDealt = w.query(DealtDamageThisTurn);
    for (const entityId of damageDealt) {
      w.removeComponent(entityId, DealtDamageThisTurn);
    }
  };

  return {
    init() {
      world.registerSystem(Phase.CLEANUP, update);
    },
    dispose() {
      world.unregisterSystem(Phase.CLEANUP, update);
    },
    update,
  };
}

export type TagCleanupSystem<T extends GameplayEvents = GameplayEvents> = ReturnType<
  typeof createTagCleanupSystem<T>
>;
