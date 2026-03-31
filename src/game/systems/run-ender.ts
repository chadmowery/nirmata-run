import { World } from '@engine/ecs/world';
import { Grid } from '@engine/grid/grid';
import { EventBus } from '@engine/events/event-bus';
import { EntityId } from '@engine/ecs/types';
import { Position } from '@shared/components/position';
import { Actor } from '@shared/components/actor';
import { AIState, AIBehaviorType } from '@shared/components/ai-state';
import { GameplayEvents } from '@shared/events/types';

/**
 * System that monitors for System_Admin adjacency to the player to end the run.
 */
export function createRunEnderSystem<T extends GameplayEvents>(
  world: World<T>,
  grid: Grid,
  eventBus: EventBus<T>
) {
  function getPlayerEntity(): { id: EntityId; x: number; y: number } | null {
    const actors = world.query(Actor, Position);
    for (const id of actors) {
      const actor = world.getComponent(id, Actor);
      if (actor?.isPlayer) {
        const pos = world.getComponent(id, Position)!;
        return { id, x: pos.x, y: pos.y };
      }
    }
    return null;
  }

  function isAdjacentOrSame(x1: number, y1: number, x2: number, y2: number): boolean {
    const dx = Math.abs(x1 - x2);
    const dy = Math.abs(y1 - y2);
    return dx <= 1 && dy <= 1;
  }

  function checkAdminAdjacency(entityId: EntityId, x: number, y: number) {
    const player = getPlayerEntity();
    if (!player) return;

    if (isAdjacentOrSame(x, y, player.x, player.y)) {
      eventBus.emit('RUN_ENDED', { 
        reason: 'FATAL: ADMIN_CONTACT', 
        entityId: player.id 
      });
      eventBus.emit('MESSAGE_EMITTED', { 
        text: 'FATAL: System_Admin made contact. Run terminated.', 
        type: 'error' 
      });
    }
  }

  function handleEntityMoved(payload: T['ENTITY_MOVED']) {
    const { entityId, toX, toY } = payload;
    
    const actor = world.getComponent(entityId, Actor);
    const aiState = world.getComponent(entityId, AIState);

    // If System_Admin moved
    if (aiState?.behaviorType === AIBehaviorType.SYSTEM_ADMIN) {
      checkAdminAdjacency(entityId, toX, toY);
    } 
    // If player moved
    else if (actor?.isPlayer) {
      // Check all System_Admins
      const admins = world.query(AIState, Position);
      for (const adminId of admins) {
        const adminAI = world.getComponent(adminId, AIState);
        if (adminAI?.behaviorType === AIBehaviorType.SYSTEM_ADMIN) {
          const adminPos = world.getComponent(adminId, Position)!;
          if (isAdjacentOrSame(toX, toY, adminPos.x, adminPos.y)) {
            eventBus.emit('RUN_ENDED', { 
              reason: 'FATAL: ADMIN_CONTACT', 
              entityId: entityId 
            });
            eventBus.emit('MESSAGE_EMITTED', { 
              text: 'FATAL: System_Admin made contact. Run terminated.', 
              type: 'error' 
            });
            break;
          }
        }
      }
    }
  }

  return {
    init() {
      eventBus.on('ENTITY_MOVED', handleEntityMoved);
    },
    dispose() {
      eventBus.off('ENTITY_MOVED', handleEntityMoved);
    }
  };
}

export type RunEnderSystem = ReturnType<typeof createRunEnderSystem>;
