import { World } from '@engine/ecs/world';
import { Grid } from '@engine/grid/grid';
import { EventBus } from '@engine/events/event-bus';
import { EntityId, Phase } from '@engine/ecs/types';
import { Position, PackMember, Actor, MovedThisTurn, Dying, ApplyStatusEffectIntent, DamageIntent } from '@shared/components';
import { logger } from '@engine/utils/logger';
import { GameplayEvents } from '@shared/events/types';
import { GameEvents } from '../events/types';

/**
 * System that coordinates swarm/pack behaviors, such as the Buffer-Overflow detonation.
 */
export function createPackCoordinatorSystem<T extends GameplayEvents>(
  world: World<T>,
  grid: Grid,
  eventBus: EventBus<T>
): PackCoordinatorSystem<T> {
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

        logger.info(`Pack Detonation Triggered: Pack ${packId} (Members: ${adjacentMembers.length})`, 'SYSTEM');

        // Apply MOVEMENT_SLOW to player once per pack detonation
        // Request status effect via intent instead of direct patching
        world.addComponent(player.id, ApplyStatusEffectIntent, {
          targetId: player.id,
          effect: {
            name: 'MOVEMENT_SLOW',
            duration: 2,
            magnitude: 50,
            source: 'buffer_overflow'
          }
        });

        eventBus.emit('MESSAGE_EMITTED', {
          text: 'A Buffer-Overflow pack detonates!',
          type: 'combat'
        });

        // Process each detonating member
        for (const memberId of adjacentMembers) {

          // Request damage via DamageIntent instead of an unused event
          world.addComponent(memberId, DamageIntent, {
            targetId: player.id,
            amount: 8
          });

          // In a real implementation, we might want to deal damage to the player here too,
          // but the event might be enough for a separate damage system to pick up.
          // For now, we follow the plan and emit events.

          // Mark the detonating member as dying
          // Per the Death Protocol, we no longer destroy entities directly
          world.addComponent(memberId, Dying, { killerId: player.id });
        }
      }
    }
  };

  const update = (w: World<T>) => {
    // Only check detonation if something moved that matters
    const movers = w.query(MovedThisTurn);
    if (movers.length === 0) return;

    let relevantMovers = false;
    for (const id of movers) {
      if (w.hasComponent(id, PackMember) || w.getComponent(id, Actor)?.isPlayer) {
        relevantMovers = true;
        break;
      }
    }

    if (relevantMovers) {
      checkDetonation();
    }
  };

  const preTurnUpdate = (w: World<T>) => {
    detonatedPacksThisTurn.clear();
  };

  return {
    init() {
      world.registerSystem(Phase.PRE_TURN, preTurnUpdate, 'PackCoordinatorPreTurnSystem');
      world.registerSystem(Phase.REACTION, update, 'PackCoordinatorReactionSystem');
    },
    dispose() {
      world.unregisterSystem(Phase.PRE_TURN, preTurnUpdate);
      world.unregisterSystem(Phase.REACTION, update);
    },
    resetTurnState() {
      detonatedPacksThisTurn.clear();
    },
    update,
    preTurnUpdate,
  };
}

export interface PackCoordinatorSystem<T extends GameplayEvents = GameEvents> {
  init(): void;
  dispose(): void;
  update(world: World<T>): void;
  resetTurnState(): void;
  preTurnUpdate(world: World<T>): void;
}
