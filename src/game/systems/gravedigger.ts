import { World } from '@engine/ecs/world';
import { Phase } from '@engine/ecs/types';
import { Dying } from '@shared/components';
import { GameplayEvents } from '@shared/events/types';

/**
 * System that removes entities marked with the Dying component at the end of the turn.
 */
export function createGravediggerSystem<T extends GameplayEvents>(world: World<T>) {
  const update = (w: World<T>) => {
    const dyingEntities = w.query(Dying);
    for (const entityId of dyingEntities) {
      w.destroyEntity(entityId);
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

export type GravediggerSystem<T extends GameplayEvents = GameplayEvents> = ReturnType<
  typeof createGravediggerSystem<T>
>;
