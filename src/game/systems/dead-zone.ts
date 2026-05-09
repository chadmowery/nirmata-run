import { World } from '@engine/ecs/world';
import { Grid } from '@engine/grid/grid';
import { EventBus } from '@engine/events/event-bus';
import { EntityId } from '@engine/ecs/types';
import { DeadZone, Position, Health, Actor, Dying } from '@shared/components';
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
        // Don't damage the dead zone entity itself
        if (targetId === entityId) continue;

        const health = world.getComponent(targetId, Health);
        if (health && !world.hasComponent(targetId, Dying)) {
          const damage = deadZone.damagePerTick;
          const oldHealth = health.current;
          const nextHealth = Math.max(0, health.current - damage);
          
          world.patchComponent(targetId, Health, { current: nextHealth });
          
          eventBus.emit('DAMAGE_DEALT', {
            attackerId: (deadZone.creatorId as EntityId) ?? (entityId as EntityId),
            defenderId: targetId as EntityId,
            amount: damage,
          });

          if (nextHealth <= 0 && oldHealth > 0) {
            const actor = world.getComponent(targetId as EntityId, Actor);
            const killerId = (deadZone.creatorId as EntityId) ?? (entityId as EntityId);
            
            eventBus.emit('ENTITY_DIED', { 
              entityId: targetId as EntityId, 
              killerId,
              isPlayer: !!actor?.isPlayer 
            });
            
            // Mark as dying
            world.addComponent(targetId, Dying, { killerId });
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
   * (Kept for internal use if needed, but AI now uses EntityFactory)
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
    init() {},
    dispose() {},
    tickDeadZones,
    createDeadZone,
  };
}

export type DeadZoneSystem<T extends GameplayEvents = GameEvents> = ReturnType<typeof createDeadZoneSystem<T>>;
