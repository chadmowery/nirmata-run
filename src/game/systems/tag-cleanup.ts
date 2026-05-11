import { World } from '@engine/ecs/world';
import { Phase } from '@engine/ecs/types';
import { logger } from '@engine/utils/logger';
import { MovedThisTurn, FirmwareActivatedThisTurn, DealtDamageThisTurn, FloorTransitioned, Acting } from '@shared/components';
import { GameplayEvents } from '@shared/events/types';

/**
 * System that cleans up transient turn-based tags.
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

    const transitions = w.query(FloorTransitioned);
    for (const entityId of transitions) {
      w.removeComponent(entityId, FloorTransitioned);
    }
    const acting = w.query(Acting);
    for (const entityId of acting) {
      w.removeComponent(entityId, Acting);
    }

    if (movers.length > 0 || activated.length > 0 || damageDealt.length > 0 || transitions.length > 0 || acting.length > 0) {
      logger.debug(`Cleaning up transient tags: MovedThisTurn (${movers.length}), FirmwareActivatedThisTurn (${activated.length}), DealtDamageThisTurn (${damageDealt.length}), FloorTransitioned (${transitions.length}), Acting (${acting.length})`, 'ECS');
    }
  };

  return {
    init() {
      world.registerSystem(Phase.CLEANUP, update, 'TagCleanupSystem');
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
