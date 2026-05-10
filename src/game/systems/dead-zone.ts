import { World } from '@engine/ecs/world';
import { Grid } from '@engine/grid/grid';
import { EventBus } from '@engine/events/event-bus';
import { EntityId, Phase } from '@engine/ecs/types';
import { DeadZone, Position, Health, Dying, DamageIntent } from '@shared/components';
import { GameplayEvents } from '@shared/events/types';
import { GameEvents } from '../events/types';

/**
 * Dead zone system that manages creation, damage application, and expiration of Dead Zone tiles.
 */
export function createDeadZoneSystem<T extends GameplayEvents>(
  world: World<T>,
  grid: Grid,
  eventBus: EventBus<T>
) {
  /**
   * Ticks all dead zones: applies DoT and handles expiration.
   */
  const update = (w: World<T>) => {
    const deadZoneIds = w.query(DeadZone, Position);

    for (const entityId of deadZoneIds) {
      const deadZone = w.getComponent(entityId, DeadZone)!;
      const pos = w.getComponent(entityId, Position)!;

      // 1. Deal damage to all entities on this tile
      const entitiesOnTile = grid.getEntitiesAt(pos.x, pos.y);
      for (const targetId of entitiesOnTile) {
        // Don't damage the dead zone entity itself
        if (targetId === entityId) continue;

        if (w.hasComponent(targetId, Health) && !w.hasComponent(targetId, Dying)) {
          // Request damage via DamageIntent instead of direct patching
          w.addComponent(entityId, DamageIntent, {
            targetId: targetId as EntityId,
            amount: deadZone.damagePerTick,
          });
        }
      }

      // 2. Decrement remaining turns
      const nextTurns = deadZone.remainingTurns - 1;
      w.patchComponent(entityId, DeadZone, { remainingTurns: nextTurns });

      // 3. Handle expiration
      if (nextTurns <= 0) {
        eventBus.emit('DEAD_ZONE_EXPIRED', { x: pos.x, y: pos.y });
        // Mark as dying and let Gravedigger purge it
        w.addComponent(entityId, Dying, { reason: 'expiration' });
      }
    }
  };

  /**
   * Creates a new Dead Zone entity at the specified coordinates.
   */
  const createDeadZone = (
    x: number,
    y: number,
    duration: number,
    damagePerTick: number,
    creatorId: EntityId
  ) => {
    const entityId = world.createEntity();
    world.addComponent(entityId, Position, { x, y });
    world.addComponent(entityId, DeadZone, {
      remainingTurns: duration,
      damagePerTick,
      creatorId,
    });

    grid.addEntity(entityId, x, y);

    eventBus.emit('DEAD_ZONE_CREATED', { x, y, duration, creatorId });
  };

  return {
    init() {
      world.registerSystem(Phase.POST_TURN, update);
    },
    dispose() {
      world.unregisterSystem(Phase.POST_TURN, update);
    },
    update,
    createDeadZone,
  };
}

export type DeadZoneSystem<T extends GameplayEvents = GameEvents> = ReturnType<typeof createDeadZoneSystem<T>>;
