import { World } from '@engine/ecs/world';
import { Grid } from '@engine/grid/grid';
import { EventBus } from '@engine/events/event-bus';
import { EntityId } from '@engine/ecs/types';
import { Position } from '../components/position';
import { Hostile } from '../components/hostile';
import { BlocksMovement } from '../components/blocks-movement';
import { GameEvents } from '../events/types';

export type MoveResult = 'moved' | 'blocked' | 'bump-attack';

/**
 * Creates a movement system that handles entity movement and collision.
 */
export function createMovementSystem(world: World, grid: Grid, eventBus: EventBus<GameEvents>) {
  return {
    /**
     * Processes a movement intent for an entity.
     * @returns The result of the movement attempt.
     */
    processMove(entityId: EntityId, dx: number, dy: number): MoveResult {
      const pos = world.getComponent(entityId, Position);
      if (!pos) return 'blocked';

      const targetX = pos.x + dx;
      const targetY = pos.y + dy;

      // 1. Check bounds
      if (!grid.inBounds(targetX, targetY)) {
        return 'blocked';
      }

      // 2. Check walkability (static terrain)
      if (!grid.isWalkable(targetX, targetY)) {
        return 'blocked';
      }

      // 3. Check entity collisions
      const occupants = grid.getEntitiesAt(targetX, targetY);
      for (const occupantId of occupants) {
        if (occupantId === entityId) continue;

        // Check for hostile entities (bump-attack)
        if (world.hasComponent(occupantId, Hostile)) {
          eventBus.emit('BUMP_ATTACK', {
            attackerId: entityId,
            defenderId: occupantId,
          });
          return 'bump-attack';
        }

        // Check for non-hostile blocking entities
        if (world.hasComponent(occupantId, BlocksMovement)) {
          return 'blocked';
        }
      }

      // 4. Perform movement
      const oldX = pos.x;
      const oldY = pos.y;
      
      // Update position component
      pos.x = targetX;
      pos.y = targetY;
      
      // Update grid spatial index
      grid.moveEntity(entityId, oldX, oldY, targetX, targetY);

      // Emit movement event
      eventBus.emit('ENTITY_MOVED', {
        entityId,
        fromX: oldX,
        fromY: oldY,
        toX: targetX,
        toY: targetY,
      });

      return 'moved';
    }
  };
}

export type MovementSystem = ReturnType<typeof createMovementSystem>;
