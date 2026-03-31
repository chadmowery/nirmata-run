import { World } from '@engine/ecs/world';
import { Grid } from '@engine/grid/grid';
import { EventBus } from '@engine/events/event-bus';
import { EntityId } from '@engine/ecs/types';
import { Position, PackMember, Actor, StatusEffects } from '@shared/components';
import { GameplayEvents } from '@shared/events/types';

/**
 * System that coordinates swarm/pack behaviors, such as the Buffer-Overflow detonation.
 */
export function createPackCoordinatorSystem<T extends GameplayEvents>(
  world: World<T>,
  grid: Grid,
  eventBus: EventBus<T>
) {
  const detonatedPacksThisTurn = new Set<string>();

  /**
   * Finds the player entity and its position.
   */
  function findPlayerPos(): { id: EntityId; x: number; y: number } | null {
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

  /**
   * Checks if a pack should detonate based on player proximity.
   */
  const checkDetonation = () => {
    const player = findPlayerPos();
    if (!player) return;

    // We check all packs that haven't detonated yet this turn
    const members = world.query(PackMember, Position);
    const packsInRange = new Map<string, EntityId[]>();

    for (const memberId of members) {
      const pm = world.getComponent(memberId, PackMember)!;
      if (detonatedPacksThisTurn.has(pm.packId)) continue;

      const pos = world.getComponent(memberId, Position)!;
      const dist = Math.abs(pos.x - player.x) + Math.abs(pos.y - player.y);
      
      if (dist === 1) {
        if (!packsInRange.has(pm.packId)) {
          packsInRange.set(pm.packId, []);
        }
        packsInRange.get(pm.packId)!.push(memberId);
      }
    }

    for (const [packId, adjacentMembers] of packsInRange.entries()) {
      if (adjacentMembers.length >= 3) {
        detonatedPacksThisTurn.add(packId);
        
        // Apply MOVEMENT_SLOW to player once per pack detonation
        const statusEffects = world.getComponent(player.id, StatusEffects);
        if (statusEffects) {
          statusEffects.effects.push({
            name: 'MOVEMENT_SLOW',
            duration: 2,
            magnitude: 50,
            source: 'buffer_overflow'
          });
          eventBus.emit('STATUS_EFFECT_APPLIED', {
            entityId: player.id,
            effectName: 'MOVEMENT_SLOW',
            duration: 2,
            magnitude: 50,
            source: 'buffer_overflow'
          });
        }

        eventBus.emit('MESSAGE_EMITTED', {
          text: 'A Buffer-Overflow pack detonates!',
          type: 'combat'
        });

        // Process each detonating member
        for (const memberId of adjacentMembers) {
          const pos = world.getComponent(memberId, Position)!;
          
          eventBus.emit('PACK_DETONATION', {
            entityId: memberId,
            x: pos.x,
            y: pos.y,
            packId,
            damage: 8
          });

          // In a real implementation, we might want to deal damage to the player here too,
          // but the event might be enough for a separate damage system to pick up.
          // For now, we follow the plan and emit events.
          
          // Destroy the detonating member
          world.destroyEntity(memberId);
          grid.removeEntity(memberId, pos.x, pos.y);
        }
      }
    }
  };

  const onEntityMoved = () => {
    checkDetonation();
  };

  const onTurnStart = () => {
    detonatedPacksThisTurn.clear();
  };

  return {
    init() {
      eventBus.on('ENTITY_MOVED', onEntityMoved);
      eventBus.on('TURN_START', onTurnStart);
    },
    dispose() {
      eventBus.off('ENTITY_MOVED', onEntityMoved);
      eventBus.off('TURN_START', onTurnStart);
    },
    resetTurnState() {
      detonatedPacksThisTurn.clear();
    }
  };
}

export type PackCoordinatorSystem = ReturnType<typeof createPackCoordinatorSystem>;
