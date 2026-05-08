import { World } from '@engine/ecs/world';
import { Grid } from '@engine/grid/grid';
import { EventBus } from '@engine/events/event-bus';
import { EntityId } from '@engine/ecs/types';
import { DeadZone, Position, Health, Actor } from '@shared/components';
import { GameplayEvents } from '@shared/events/types';

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
   * This should be called once per turn cycle.
   */
  const tickDeadZones = () => {
    const deadZoneIds = world.query(DeadZone, Position);

    for (const entityId of deadZoneIds) {
      const deadZone = world.getComponent(entityId, DeadZone)!;
      const pos = world.getComponent(entityId, Position)!;

      // 1. Deal damage to all entities on this tile
      const entitiesOnTile = grid.getEntitiesAt(pos.x, pos.y);
      for (const targetId of entitiesOnTile) {
        // Don't damage the dead zone entity itself (though it doesn't have Health usually)
        if (targetId === entityId) continue;

        const health = world.getComponent(targetId, Health);
        if (health) {
          const damage = deadZone.damagePerTick;
          const nextHealth = Math.max(0, health.current - damage);
          world.patchComponent(targetId, Health, { current: nextHealth });
          
          eventBus.emit('DAMAGE_DEALT', {
            attackerId: (deadZone.creatorId as EntityId) ?? (entityId as EntityId),
            defenderId: targetId as EntityId,
            amount: damage,
          });

          // Basic death check - if health system is added later, this can be moved
          if (nextHealth <= 0) {
            const actor = world.getComponent(targetId as EntityId, Actor);
            eventBus.emit('ENTITY_DIED', { 
              entityId: targetId as EntityId, 
              killerId: (deadZone.creatorId as EntityId) ?? (entityId as EntityId),
              isPlayer: !!actor?.isPlayer 
            });
            
            const targetPos = world.getComponent(targetId, Position);
            if (targetPos) {
              grid.removeEntity(targetId, targetPos.x, targetPos.y);
            }
            world.destroyEntity(targetId);
          }
        }
      }

      // 2. Decrement remaining turns
      const nextTurns = deadZone.remainingTurns - 1;
      world.patchComponent(entityId, DeadZone, { remainingTurns: nextTurns });

      // 3. Handle expiration
      if (nextTurns <= 0) {
        eventBus.emit('DEAD_ZONE_EXPIRED', { x: pos.x, y: pos.y });
        grid.removeEntity(entityId, pos.x, pos.y);
        world.destroyEntity(entityId);
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
      eventBus.on('CREATE_DEAD_ZONE', onCreateDeadZoneRequested);
    },
    dispose() {
      eventBus.off('CREATE_DEAD_ZONE', onCreateDeadZoneRequested);
    },
    tickDeadZones,
    createDeadZone,
  };

  function onCreateDeadZoneRequested(payload: T['CREATE_DEAD_ZONE']) {
    createDeadZone(
      payload.x,
      payload.y,
      payload.duration,
      payload.damagePerTick,
      payload.creatorId
    );
  }
}

export type DeadZoneSystem = ReturnType<typeof createDeadZoneSystem>;
