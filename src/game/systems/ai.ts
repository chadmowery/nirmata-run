import AStar from 'rot-js/lib/path/astar';
import PreciseShadowcasting from 'rot-js/lib/fov/precise-shadowcasting';
import { World } from '@engine/ecs/world';
import { Grid } from '@engine/grid/grid';
import { EntityId } from '@engine/ecs/types';
import { Position } from '@shared/components/position';
import { Actor } from '@shared/components/actor';
import { AIState, AIBehavior } from '@shared/components/ai-state';
import { FovAwareness } from '@shared/components/fov-awareness';
import { GameplayEvents } from '@shared/events/types';

/**
 * AI System handles enemy decision making and behavior state transitions.
 */
export function createAISystem<T extends GameplayEvents>(
  world: World<T>,
  grid: Grid,
  movementSystem: { processMove: (eid: EntityId, dx: number, dy: number) => void }
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
     * Processes a single enemy's turn.
     */
    processEnemyTurn(entityId: EntityId): void {
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
    }
  };
}

export type AISystem = ReturnType<typeof createAISystem>;
