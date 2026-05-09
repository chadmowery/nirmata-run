import { World } from '@engine/ecs/world';
import { Phase } from '@engine/ecs/types';
import { MovedThisTurn } from '@shared/components';
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
