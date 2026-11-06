import { World } from '@engine/ecs/world';
import { logger } from '@engine/utils/logger';
import { Grid } from '@engine/grid/grid';
import { EventBus } from '@engine/events/event-bus';
import { Phase } from '@engine/ecs/types';
import { Position } from '@shared/components/position';
import { Hostile } from '@shared/components/hostile';
import { Actor } from '@shared/components/actor';
import { BlocksMovement } from '@shared/components/blocks-movement';
import { StatusEffects } from '@shared/components/status-effects';
import { Heat } from '@shared/components/heat';
import { MoveIntent, AttackIntent, MovedThisTurn, ActionAbortedTag } from '@shared/components/index';
import {
  Prop,
  SecurityLock,
  CorruptedNode,
  DirectionalProp,
  vectorToOrientation,
  InteractPropIntent,
} from '@shared/components/environment';
import { playerHasAccessKey } from '@shared/utils/access-key-util';

import { GameplayEvents } from '@shared/events/types';

/**
 * Movement system that resolves MoveIntent during the ACTION phase.
 */
export function createMovementSystem<T extends GameplayEvents>(
  world: World<T>,
  grid: Grid,
  eventBus: EventBus<T>,
  isClient: boolean = false,
) {
  const update = (w: World<T>) => {
    const entities = w.query(MoveIntent, Position);

    for (const entityId of entities) {
      const intent = w.getComponent(entityId, MoveIntent)!;
      const pos = w.getComponent(entityId, Position)!;

      // 1. Check for status effects that impede movement
      const statusEffects = w.getComponent(entityId, StatusEffects);
      if (statusEffects) {
        if (statusEffects.effects.some((e) => e.name === 'CRITICAL_REBOOT')) {
          eventBus.emit('MESSAGE_EMITTED', {
            text: 'System is rebooting... Movement disabled!',
            type: 'error',
          });
          w.removeComponent(entityId, MoveIntent);
          continue;
        }

        if (statusEffects.effects.some((e) => e.name === 'INPUT_LAG')) {
          if (Math.random() < 0.5) {
            eventBus.emit('MESSAGE_EMITTED', {
              text: 'Input lag! Command dropped.',
              type: 'warning',
            });
            w.removeComponent(entityId, MoveIntent);
            continue;
          }
        }
      }

      const targetX = pos.x + intent.dx;
      const targetY = pos.y + intent.dy;

      // 2. Check bounds
      if (!grid.inBounds(targetX, targetY)) {
        w.removeComponent(entityId, MoveIntent);
        continue;
      }

      // 3. Check walkability (static terrain)
      if (!grid.isWalkable(targetX, targetY)) {
        w.removeComponent(entityId, MoveIntent);
        continue;
      }

      // 4. Check entity collisions
      const occupants = grid.getEntitiesAt(targetX, targetY);
      const attacker = w.getComponent(entityId, Actor);
      const isAttackerPlayer = attacker?.isPlayer ?? false;

      let blocked = false;
      let combatTriggered = false;

      for (const occupantId of occupants) {
        if (occupantId === entityId) continue;

        const defenderHostile = w.hasComponent(occupantId, Hostile);
        const defenderActor = w.getComponent(occupantId, Actor);
        const isDefenderPlayer = defenderActor?.isPlayer ?? false;

        // Convert MoveIntent to AttackIntent if: Player -> Hostile OR Hostile -> Player
        if ((isAttackerPlayer && defenderHostile) || (!isAttackerPlayer && isDefenderPlayer)) {
          w.addComponent(entityId, AttackIntent, { targetId: occupantId });
          combatTriggered = true;
          break;
        }

        // Two-Tier Bump-to-Loot Safeguard for player collisions with interactive props
        if (isAttackerPlayer && w.hasComponent(occupantId, Prop)) {
          const prop = w.getComponent(occupantId, Prop)!;

          // Check CorruptedNode (Tier 2 Risk when revealed: Halt movement, 0 energy cost, warn & flush queue)
          const corrupted = w.getComponent(occupantId, CorruptedNode);
          if (corrupted && !corrupted.isDisarmed && !corrupted.triggered && corrupted.revealed) {
            if (!isClient) {
              eventBus.emit('MESSAGE_EMITTED', {
                text: '[SECURITY FAULT]: Corrupted terminal detected (acoustic trap / EMP dump). Disarm with Logic_Jam or hack carefully.',
                type: 'warning',
              });
            }
            eventBus.emit('INPUT_BUFFER_CLEARED', {});
            w.addComponent(entityId, ActionAbortedTag, {});
            blocked = true;
            break;
          }

          // Check SecurityLock (Tier 2 Risk if locked without key)
          const lock = w.getComponent(occupantId, SecurityLock);
          if (lock && lock.isLocked) {
            const hasKey = playerHasAccessKey(w, entityId);
            if (!hasKey) {
              if (!isClient) {
                const heat = w.getComponent(entityId, Heat);
                const currentHeat = heat?.current ?? 0;
                const cost = lock.overclockHeatCost ?? 35;

                if (currentHeat + cost > 100) {
                  eventBus.emit('MESSAGE_EMITTED', {
                    text: `[HEAT CRITICAL]: Overclocking would exceed 100 Heat (${currentHeat + cost}/100) and trigger Emergency Shutdown. Vent Heat first.`,
                    type: 'error',
                  });
                } else {
                  eventBus.emit('MESSAGE_EMITTED', {
                    text: `[OVERCLOCK WARNING]: Overclocking blast lock costs +${cost} Heat and triggers an acoustic alert (radius ${lock.alertRadiusOnBypass ?? 12}). Safe bypass requires Access Key.`,
                    type: 'warning',
                  });
                }
              }
              eventBus.emit('INPUT_BUFFER_CLEARED', {});
              w.addComponent(entityId, ActionAbortedTag, {});
              blocked = true;
              break;
            }
          }

          // Check DirectionalProp (Front-facing access constraint)
          const directional = w.getComponent(occupantId, DirectionalProp);
          if (directional && directional.requiresFrontAccess) {
            const dxToPlayer = pos.x - targetX;
            const dyToPlayer = pos.y - targetY;
            const fx = directional.frontFacingVector.x;
            const fy = directional.frontFacingVector.y;

            if (dxToPlayer !== fx || dyToPlayer !== fy) {
              if (!isClient) {
                const facingOrientation = vectorToOrientation(fx, fy);
                const propName = (prop.propClass ?? 'prop').toUpperCase();
                eventBus.emit('MESSAGE_EMITTED', {
                  text: `[NOTICE] ${propName} FRONT INTERFACE IS TO THE ${facingOrientation}.`,
                  type: 'warning',
                });
              }
              eventBus.emit('INPUT_BUFFER_CLEARED', {});
              w.addComponent(entityId, ActionAbortedTag, {});
              blocked = true;
              break;
            }
          }

          // Safe & Unsearched (or locked with valid key): Convert MoveIntent to InteractPropIntent
          if (!prop.isSearched || (lock && lock.isLocked)) {
            if (!isClient) {
              w.addComponent(entityId, InteractPropIntent, {
                targetPropId: occupantId,
                forceOverride: false,
              });
            }
            blocked = true;
            break;
          }
        }

        // Check for non-hostile blocking entities
        if (w.hasComponent(occupantId, BlocksMovement)) {
          blocked = true;
          break;
        }
      }

      if (combatTriggered || blocked) {
        w.removeComponent(entityId, MoveIntent);
        continue;
      }

      // 5. Perform movement
      const oldX = pos.x;
      const oldY = pos.y;

      w.patchComponent(entityId, Position, { x: targetX, y: targetY });
      grid.moveEntity(entityId, oldX, oldY, targetX, targetY);
      logger.debug(
        `Entity ${entityId} moved: (${oldX}, ${oldY}) -> (${targetX}, ${targetY})`,
        'SYSTEM',
      );

      // Attach tag for reactive systems
      w.addComponent(entityId, MovedThisTurn, {
        fromX: oldX,
        fromY: oldY,
        toX: targetX,
        toY: targetY,
      });

      // Emit movement event for UI/Rendering
      eventBus.emit('ENTITY_MOVED', {
        entityId,
        fromX: oldX,
        fromY: oldY,
        toX: targetX,
        toY: targetY,
      });

      // Cleanup intent
      w.removeComponent(entityId, MoveIntent);
    }
  };

  return {
    init() {
      world.registerSystem(Phase.ACTION, update, 'MovementSystem');
    },
    dispose() {
      world.unregisterSystem(Phase.ACTION, update);
    },
    // We keep update exposed for manual execution in pipeline.ts
    update,
  };
}

export type MovementSystem<T extends GameplayEvents = GameplayEvents> = ReturnType<
  typeof createMovementSystem<T>
>;
