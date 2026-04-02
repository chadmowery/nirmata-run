import { World } from '@engine/ecs/world';
import { Grid } from '@engine/grid/grid';
import { EventBus } from '@engine/events/event-bus';
import { EntityId } from '@engine/ecs/types';
import { Position } from '@shared/components/position';
import { Actor } from '@shared/components/actor';
import { AIState, AIBehaviorType } from '@shared/components/ai-state';
import { FloorState } from '@shared/components/floor-state';
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
      const floorState = world.getComponent(player.id, FloorState);
      eventBus.emit('RUN_ENDED', { 
        reason: 'FATAL: ADMIN_CONTACT', 
        entityId: player.id,
        floorNumber: floorState?.currentFloor ?? 1,
        stats: {} 
      } as unknown as T['RUN_ENDED']);
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
            const floorState = world.getComponent(entityId, FloorState);
            eventBus.emit('RUN_ENDED', { 
              reason: 'FATAL: ADMIN_CONTACT', 
              entityId: entityId,
              floorNumber: floorState?.currentFloor ?? 1,
              stats: {}
            } as unknown as T['RUN_ENDED']);
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

  const handleStabilityZero = (payload: T['STABILITY_ZERO']) => {
    const actor = world.getComponent(payload.entityId, Actor);
    if (actor?.isPlayer) {
      const floorState = world.getComponent(payload.entityId, FloorState);
      eventBus.emit('RUN_ENDED', {
        reason: 'CRITICAL_INSTABILITY',
        entityId: payload.entityId,
        floorNumber: floorState?.currentFloor ?? 1,
        stats: {}
      } as unknown as T['RUN_ENDED']);
      eventBus.emit('MESSAGE_EMITTED', {
        text: 'FATAL: Reality anchor collapsed. Neural link lost.',
        type: 'error'
      });
    }
  };

  const handleAnchorExtract = () => {
    const player = getPlayerEntity();
    if (player) {
      const floorState = world.getComponent(player.id, FloorState);
      eventBus.emit('RUN_ENDED', {
        reason: 'extraction',
        entityId: player.id,
        floorNumber: floorState?.currentFloor ?? 1,
        stats: {}
      } as unknown as T['RUN_ENDED']);
      eventBus.emit('MESSAGE_EMITTED', {
        text: 'SUCCESS: Extraction protocol complete. Neural link severed safely.',
        type: 'info'
      });
    }
  };

  return {
    init() {
      eventBus.on('ENTITY_MOVED', handleEntityMoved);
      eventBus.on('STABILITY_ZERO', handleStabilityZero);
      eventBus.on('ANCHOR_EXTRACT', handleAnchorExtract);
    },
    dispose() {
      eventBus.off('ENTITY_MOVED', handleEntityMoved);
      eventBus.off('STABILITY_ZERO', handleStabilityZero);
      eventBus.off('ANCHOR_EXTRACT', handleAnchorExtract);
    }
  };
}

export type RunEnderSystem = ReturnType<typeof createRunEnderSystem>;
