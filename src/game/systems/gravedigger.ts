import { World } from '@engine/ecs/world';
import { Phase } from '@engine/ecs/types';
import { logger } from '@engine/utils/logger';
import { Grid } from '@engine/grid/grid';
import { Dying, Position } from '@shared/components';
import { GameplayEvents } from '@shared/events/types';

/**
 * System that removes entities marked with the Dying component at the end of the turn.
 * Per the Death Protocol, this system is the only one authorized to destroy entities.
 */
export function createGravediggerSystem<T extends GameplayEvents>(world: World<T>, grid: Grid) {
  const update = (w: World<T>) => {
    const dyingEntities = w.query(Dying);
    for (const entityId of dyingEntities) {
      // 1. Grid removal to ensure spatial index is clean
      const pos = w.getComponent(entityId, Position);
      if (pos) {
        grid.removeEntity(entityId, pos.x, pos.y);
      }

      // 2. Final purge
      logger.debug(`Gravedigger purging entity ${entityId}`, 'ECS');
      w.destroyEntity(entityId);
    }
  };

  return {
    init() {
      world.registerSystem(Phase.CLEANUP, update, 'GravediggerSystem');
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
