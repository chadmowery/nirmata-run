import AStar from 'rot-js/lib/path/astar';
import PreciseShadowcasting from 'rot-js/lib/fov/precise-shadowcasting';
import { World } from '@engine/ecs/world';
import { Grid } from '@engine/grid/grid';
import { EventBus } from '@engine/events/event-bus';
import { EntityId } from '@engine/ecs/types';
import { Position } from '@shared/components/position';
import { Actor } from '@shared/components/actor';
import { AIState, AIBehavior, AIBehaviorType } from '@shared/components/ai-state';
import { FovAwareness } from '@shared/components/fov-awareness';
import { PackMember } from '@shared/components/pack-member';
import { StatusEffects } from '@shared/components/status-effects';
import { Health } from '@shared/components/health';
import { Defense } from '@shared/components/defense';
import { GameplayEvents } from '@shared/events/types';
import { MoveResult } from './movement';

/**
 * AI System handles enemy decision making and behavior state transitions.
 */
export function createAISystem<T extends GameplayEvents>(
  world: World<T>,
  grid: Grid,
  eventBus: EventBus<T>,
  movementSystem: { processMove: (eid: EntityId, dx: number, dy: number) => MoveResult },
  deadZoneSystem: { createDeadZone: (x: number, y: number, duration: number, damagePerTick: number, creatorId: EntityId) => void } | null = null
) {
  /**
   * Finds the player entity in the world.
   */
  function findPlayerEntity(): { id: EntityId; x: number; y: number } | null {
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
   * Computes FOV for an entity.
   */
  function computeEnemyFov(x: number, y: number, radius: number): Set<string> {
    const fov = new PreciseShadowcasting((tx, ty) => grid.isTransparent(tx, ty));
    const visible = new Set<string>();
    fov.compute(x, y, radius, (tx, ty, _r, visibility) => {
      if (visibility > 0) {
        visible.add(`${tx},${ty}`);
      }
    });
    return visible;
  }

  /**
   * Checks if two positions are adjacent (Manhattan distance <= 1).
   */
  function isAdjacent(x1: number, y1: number, x2: number, y2: number): boolean {
    const dx = Math.abs(x1 - x2);
    const dy = Math.abs(y1 - y2);
    return (dx === 1 && dy === 0) || (dx === 0 && dy === 1);
  }

  /**
   * Pathfinds from one position to another using A*.
   * Returns the first step (dx, dy) on the path.
   */
  function pathfindToward(fromX: number, fromY: number, toX: number, toY: number): { dx: number; dy: number } | null {
    const astar = new AStar(toX, toY, (x, y) => {
      // Allow the start and end positions, otherwise check walkability
      if (x === fromX && y === fromY) return true;
      if (x === toX && y === toY) return true;
      return grid.isWalkable(x, y);
    }, { topology: 4 });

    const path: [number, number][] = [];
    astar.compute(fromX, fromY, (x, y) => {
      path.push([x, y]);
    });

    // path[0] is fromX, fromY. path[1] is the next step.
    if (path.length > 1) {
      const nextStep = path[1];
      return {
        dx: nextStep[0] - fromX,
        dy: nextStep[1] - fromY
      };
    }

    return null;
  }

  return {
    /**
     * Processes a single enemy's turn using basic behavior.
     */
    processBasicTurn(entityId: EntityId): void {
      const pos = world.getComponent(entityId, Position);
      const ai = world.getComponent(entityId, AIState);
      const awareness = world.getComponent(entityId, FovAwareness);

      if (!pos || !ai || !awareness) return;

      const player = findPlayerEntity();
      if (!player) return;

      // 1. Update FOV awareness
      const visibleTiles = computeEnemyFov(pos.x, pos.y, ai.sightRadius);
      const playerKey = `${player.x},${player.y}`;
      const canSeePlayer = visibleTiles.has(playerKey);

      awareness.canSeePlayer = canSeePlayer;
      if (canSeePlayer) {
        awareness.lastKnownPlayerX = player.x;
        awareness.lastKnownPlayerY = player.y;
      }

      // 2. State transitions
      const adjacent = isAdjacent(pos.x, pos.y, player.x, player.y);

      if (ai.behavior === AIBehavior.IDLE) {
        if (canSeePlayer) {
          ai.behavior = AIBehavior.CHASING;
        }
      }

      if (ai.behavior === AIBehavior.CHASING) {
        if (adjacent) {
          ai.behavior = AIBehavior.ATTACKING;
        } else if (!canSeePlayer && awareness.lastKnownPlayerX === undefined) {
          ai.behavior = AIBehavior.IDLE;
        }
      }

      if (ai.behavior === AIBehavior.ATTACKING) {
        if (!adjacent) {
          if (canSeePlayer) {
            ai.behavior = AIBehavior.CHASING;
          } else {
            ai.behavior = AIBehavior.IDLE;
          }
        }
      }

      // 3. Execute behavior
      if (ai.behavior === AIBehavior.CHASING) {
        const targetX = awareness.lastKnownPlayerX ?? player.x;
        const targetY = awareness.lastKnownPlayerY ?? player.y;
        
        const step = pathfindToward(pos.x, pos.y, targetX, targetY);
        if (step) {
          movementSystem.processMove(entityId, step.dx, step.dy);
        }
      } else if (ai.behavior === AIBehavior.ATTACKING) {
        // Move toward player to trigger bump attack
        const dx = player.x - pos.x;
        const dy = player.y - pos.y;
        movementSystem.processMove(entityId, dx, dy);
      }
    },

    /**
     * Processes a single enemy's turn.
     */
    processEnemyTurn(entityId: EntityId): void {
      const ai = world.getComponent(entityId, AIState);
      if (!ai) return;

      switch (ai.behaviorType) {
        case AIBehaviorType.NULL_POINTER:
          return this.processNullPointerTurn(entityId);
        case AIBehaviorType.BUFFER_OVERFLOW:
          return this.processBufferOverflowTurn(entityId);
        case AIBehaviorType.FRAGMENTER:
          return this.processFragmenterTurn(entityId);
        case AIBehaviorType.LOGIC_LEAKER:
          return this.processLogicLeakerTurn(entityId);
        case AIBehaviorType.SYSTEM_ADMIN:
          return this.processSystemAdminTurn(entityId);
        case AIBehaviorType.SEED_EATER:
          return this.processSeedEaterTurn(entityId);
        case AIBehaviorType.BASIC:
        default:
          return this.processBasicTurn(entityId);
      }
    },

    processSystemAdminTurn(entityId: EntityId): void {
      const pos = world.getComponent(entityId, Position);
      const ai = world.getComponent(entityId, AIState);
      const statusEffects = world.getComponent(entityId, StatusEffects);

      if (!pos || !ai) return;

      // 1. Check for DISRUPT status effect (stun)
      if (statusEffects) {
        const isDisrupted = statusEffects.effects.some(e => e.name === 'DISRUPT');
        if (isDisrupted) {
          eventBus.emit('MESSAGE_EMITTED', { 
            text: 'System_Admin is disrupted and cannot move!', 
            type: 'info' 
          });
          return;
        }
      }

      const player = findPlayerEntity();
      if (!player) return;

      // 2. Emit ADMIN_DETECTED if not already done (can be handled by a flag in AIState or similar, 
      // but plan says "on first turn". We'll just emit it, UI can throttle if needed)
      eventBus.emit('ADMIN_DETECTED', {});

      // 3. Always pathfind toward player (System_Admin has global knowledge)
      const step = pathfindToward(pos.x, pos.y, player.x, player.y);
      if (step) {
        movementSystem.processMove(entityId, step.dx, step.dy);
      }
    },

    processSeedEaterTurn(entityId: EntityId): void {
      const pos = world.getComponent(entityId, Position);
      const ai = world.getComponent(entityId, AIState);
      const awareness = world.getComponent(entityId, FovAwareness);

      if (!pos || !ai || !awareness) return;

      const player = findPlayerEntity();
      if (!player) return;

      // 1. Update FOV awareness
      const visibleTiles = computeEnemyFov(pos.x, pos.y, ai.sightRadius);
      const playerKey = `${player.x},${player.y}`;
      const canSeePlayer = visibleTiles.has(playerKey);

      awareness.canSeePlayer = canSeePlayer;
      if (canSeePlayer) {
        awareness.lastKnownPlayerX = player.x;
        awareness.lastKnownPlayerY = player.y;
      }

      // 2. Movement/Attack logic
      if (canSeePlayer) {
        if (isAdjacent(pos.x, pos.y, player.x, player.y)) {
          // Bump attack
          const dx = player.x - pos.x;
          const dy = player.y - pos.y;
          movementSystem.processMove(entityId, dx, dy);
        } else {
          // Pathfind toward player
          const step = pathfindToward(pos.x, pos.y, player.x, player.y);
          if (step) {
            movementSystem.processMove(entityId, step.dx, step.dy);
          }
        }
      } else {
        // If not visible, stay in place (Seed_Eater is "ceiling-mounted" and doesn't patrol)
      }
    },

    processFragmenterTurn(entityId: EntityId): void {
      const pos = world.getComponent(entityId, Position);
      const ai = world.getComponent(entityId, AIState);
      const awareness = world.getComponent(entityId, FovAwareness);

      if (!pos || !ai || !awareness) return;

      const player = findPlayerEntity();
      if (!player) return;

      // 1. Update FOV awareness
      const visibleTiles = computeEnemyFov(pos.x, pos.y, ai.sightRadius);
      const playerKey = `${player.x},${player.y}`;
      const canSeePlayer = visibleTiles.has(playerKey);

      awareness.canSeePlayer = canSeePlayer;
      if (canSeePlayer) {
        awareness.lastKnownPlayerX = player.x;
        awareness.lastKnownPlayerY = player.y;
      }

      // 2. Fragmenter logic
      if (canSeePlayer) {
        if (isAdjacent(pos.x, pos.y, player.x, player.y)) {
          // Ground slam!
          const dx = player.x - pos.x;
          const dy = player.y - pos.y;
          movementSystem.processMove(entityId, dx, dy);

          // Create Dead Zones on 4 cardinal adjacent tiles
          if (deadZoneSystem) {
            const directions = [[0, 1], [0, -1], [1, 0], [-1, 0]];
            for (const [ddx, ddy] of directions) {
              const tx = pos.x + ddx;
              const ty = pos.y + ddy;
              if (grid.inBounds(tx, ty) && grid.isWalkable(tx, ty)) {
                deadZoneSystem.createDeadZone(tx, ty, 6, 2, entityId);
              }
            }
          }
          eventBus.emit('MESSAGE_EMITTED', { 
            text: 'Fragmenter slams the ground! Dead Zones appear!', 
            type: 'combat' 
          });
        } else {
          // Chase player
          const step = pathfindToward(pos.x, pos.y, player.x, player.y);
          if (step) {
            movementSystem.processMove(entityId, step.dx, step.dy);
          }
        }
      }
    },

    processLogicLeakerTurn(entityId: EntityId): void {
      const pos = world.getComponent(entityId, Position);
      const ai = world.getComponent(entityId, AIState);
      const awareness = world.getComponent(entityId, FovAwareness);

      if (!pos || !ai || !awareness) return;

      const player = findPlayerEntity();
      if (!player) return;

      const KITE_RANGE = 2;
      const ATTACK_RANGE = 5;

      // 1. Update FOV awareness
      const visibleTiles = computeEnemyFov(pos.x, pos.y, ai.sightRadius);
      const playerKey = `${player.x},${player.y}`;
      const canSeePlayer = visibleTiles.has(playerKey);

      awareness.canSeePlayer = canSeePlayer;
      if (canSeePlayer) {
        awareness.lastKnownPlayerX = player.x;
        awareness.lastKnownPlayerY = player.y;
      }

      if (canSeePlayer) {
        const dist = Math.abs(pos.x - player.x) + Math.abs(pos.y - player.y);

        if (dist <= KITE_RANGE) {
          // Kite: move AWAY from player
          const vdx = pos.x - player.x;
          const vdy = pos.y - player.y;
          
          const targetX = pos.x + Math.sign(vdx) * 2;
          const targetY = pos.y + Math.sign(vdy) * 2;
          
          const step = pathfindToward(pos.x, pos.y, targetX, targetY);
          if (step) {
             movementSystem.processMove(entityId, step.dx, step.dy);
             eventBus.emit('MESSAGE_EMITTED', { text: 'Logic-Leaker retreats!', type: 'combat' });
          } else {
             this.processBasicTurn(entityId);
          }
        } else if (dist <= ATTACK_RANGE) {
          // Ranged attack
          const damage = 5;
          const projectileType = 'corrupted_packet';
          
          eventBus.emit('RANGED_ATTACK', {
            attackerId: entityId,
            defenderId: player.id,
            damage,
            projectileType
          });

          const playerHealth = world.getComponent(player.id, Health);
          const playerDefense = world.getComponent(player.id, Defense);
          if (playerHealth) {
            const armor = playerDefense?.armor ?? 0;
            const finalDamage = Math.max(1, damage - armor);
            playerHealth.current = Math.max(0, playerHealth.current - finalDamage);
            
            eventBus.emit('DAMAGE_DEALT', {
              attackerId: entityId,
              defenderId: player.id,
              amount: finalDamage
            });

            // Apply FIRMWARE_LOCK
            const statusEffects = world.getComponent(player.id, StatusEffects);
            if (statusEffects) {
              statusEffects.effects.push({
                name: 'FIRMWARE_LOCK',
                duration: 3,
                magnitude: 1,
                source: 'logic_leaker'
              });
              eventBus.emit('STATUS_EFFECT_APPLIED', {
                entityId: player.id,
                effectName: 'FIRMWARE_LOCK',
                duration: 3,
                magnitude: 1,
                source: 'logic_leaker'
              });
            }

            eventBus.emit('MESSAGE_EMITTED', { 
              text: 'Logic-Leaker fires a Corrupted Packet! Firmware locked!', 
              type: 'combat' 
            });

            if (playerHealth.current <= 0) {
               eventBus.emit('ENTITY_DIED', { entityId: player.id, killerId: entityId, isPlayer: true });
               
               const playerPos = world.getComponent(player.id, Position);
               if (playerPos) {
                 grid.removeEntity(player.id, playerPos.x, playerPos.y);
               }
               world.destroyEntity(player.id);
            }
          }
        } else {
          // Chase player (close the gap)
          const step = pathfindToward(pos.x, pos.y, player.x, player.y);
          if (step) {
            movementSystem.processMove(entityId, step.dx, step.dy);
          }
        }
      }
    },

    processNullPointerTurn(entityId: EntityId): void {
      const pos = world.getComponent(entityId, Position);
      const ai = world.getComponent(entityId, AIState);
      const awareness = world.getComponent(entityId, FovAwareness);

      if (!pos || !ai || !awareness) return;

      const player = findPlayerEntity();
      if (!player) return;

      // 1. Update FOV awareness
      const visibleTiles = computeEnemyFov(pos.x, pos.y, ai.sightRadius);
      const playerKey = `${player.x},${player.y}`;
      const canSeePlayer = visibleTiles.has(playerKey);

      awareness.canSeePlayer = canSeePlayer;
      if (canSeePlayer) {
        awareness.lastKnownPlayerX = player.x;
        awareness.lastKnownPlayerY = player.y;
      }

      const dist = Math.abs(pos.x - player.x) + Math.abs(pos.y - player.y);

      // 2. Teleport if visible and within range (8 tiles) but not already adjacent
      if (canSeePlayer && dist > 1 && dist <= 8) {
        const dx = Math.sign(player.x - pos.x);
        const dy = Math.sign(player.y - pos.y);
        
        // Target is "behind" the player relative to current position
        const targetX = player.x + dx;
        const targetY = player.y + dy;

        let finalX = -1;
        let finalY = -1;

        // Search for walkable tile near target
        outer: for (let r = 0; r <= 3; r++) {
          for (let tx = -r; tx <= r; tx++) {
            for (let ty = -r; ty <= r; ty++) {
              if (Math.abs(tx) + Math.abs(ty) !== r) continue;
              const x = targetX + tx;
              const y = targetY + ty;
              if (grid.inBounds(x, y) && grid.isWalkable(x, y) && grid.getEntitiesAt(x, y).size === 0) {
                finalX = x;
                finalY = y;
                break outer;
              }
            }
          }
        }

        if (finalX !== -1) {
          const fromX = pos.x;
          const fromY = pos.y;
          pos.x = finalX;
          pos.y = finalY;
          grid.removeEntity(entityId, fromX, fromY);
          grid.addEntity(entityId, finalX, finalY);
          eventBus.emit('ENEMY_TELEPORTED', { entityId, fromX, fromY, toX: finalX, toY: finalY });
          eventBus.emit('MESSAGE_EMITTED', { text: 'A Null-Pointer teleports behind you!', type: 'combat' });
          return;
        }
      }

      // 3. Attack if adjacent
      if (isAdjacent(pos.x, pos.y, player.x, player.y)) {
        const adx = player.x - pos.x;
        const ady = player.y - pos.y;
        const result = movementSystem.processMove(entityId, adx, ady);
        
        if (result === 'bump-attack') {
          const statusEffects = world.getComponent(player.id, StatusEffects);
          if (statusEffects) {
            statusEffects.effects.push({
              name: 'HUD_GLITCH',
              duration: 2,
              magnitude: 1,
              source: 'null_pointer'
            });
            eventBus.emit('STATUS_EFFECT_APPLIED', {
              entityId: player.id,
              effectName: 'HUD_GLITCH',
              duration: 2,
              magnitude: 1,
              source: 'null_pointer'
            });
          }
        }
        return;
      }

      // 4. Fallback to basic chasing/pathfinding
      this.processBasicTurn(entityId);
    },

    processBufferOverflowTurn(entityId: EntityId): void {
      const pos = world.getComponent(entityId, Position);
      const pack = world.getComponent(entityId, PackMember);
      const ai = world.getComponent(entityId, AIState);

      if (!pos || !pack || !ai) {
        return this.processBasicTurn(entityId);
      }

      const player = findPlayerEntity();
      if (!player) return;

      // Leader uses basic chasing behavior
      if (pack.isLeader) {
        return this.processBasicTurn(entityId);
      }

      // Follower tries to surround player
      const targets = [
        { x: player.x + 1, y: player.y },
        { x: player.x - 1, y: player.y },
        { x: player.x, y: player.y + 1 },
        { x: player.x, y: player.y - 1 },
      ].filter(t => 
        grid.inBounds(t.x, t.y) && 
        grid.isWalkable(t.x, t.y) && 
        (grid.getEntitiesAt(t.x, t.y).size === 0 || (t.x === pos.x && t.y === pos.y))
      );

      if (targets.length === 0) {
        return this.processBasicTurn(entityId);
      }

      // Sort by proximity to follower
      targets.sort((a, b) => {
        const distA = Math.abs(a.x - pos.x) + Math.abs(a.y - pos.y);
        const distB = Math.abs(b.x - pos.x) + Math.abs(b.y - pos.y);
        return distA - distB;
      });

      const bestTarget = targets[0];
      
      // If already at best target, do nothing (wait for detonation)
      if (bestTarget.x === pos.x && bestTarget.y === pos.y) {
        return;
      }

      const step = pathfindToward(pos.x, pos.y, bestTarget.x, bestTarget.y);
      if (step) {
        movementSystem.processMove(entityId, step.dx, step.dy);
      }
    },

    dispose() {}
  };
}

export type AISystem = ReturnType<typeof createAISystem>;
