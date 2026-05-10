import { World } from '@engine/ecs/world';
import { Grid } from '@engine/grid/grid';
import { EventBus } from '@engine/events/event-bus';
import { Phase } from '@engine/ecs/types';
import { Position } from '@shared/components/position';
import { TeleportIntent, MovedThisTurn } from '@shared/components/index';
import { GameplayEvents } from '@shared/events/types';

/**
 * Teleport system that resolves TeleportIntent during the ACTION phase.
 * Teleports bypass walkability and collision checks by default.
 */
export function createTeleportSystem<T extends GameplayEvents>(
  world: World<T>,
  grid: Grid,
  eventBus: EventBus<T>
) {
  const update = (w: World<T>) => {
    const entities = w.query(TeleportIntent, Position);

    for (const entityId of entities) {
      const intent = w.getComponent(entityId, TeleportIntent)!;
      const pos = w.getComponent(entityId, Position)!;

      const targetX = intent.x;
      const targetY = intent.y;

      // Basic bounds check to prevent engine crashes, though AI/Firmware should validate this
      if (!grid.inBounds(targetX, targetY)) {
        w.removeComponent(entityId, TeleportIntent);
        continue;
      }

      const oldX = pos.x;
      const oldY = pos.y;

      // 1. Update state
      w.patchComponent(entityId, Position, { x: targetX, y: targetY });
      grid.moveEntity(entityId, oldX, oldY, targetX, targetY);

      // 2. Attach tag for reactive systems (like ItemPickupSystem)
      w.addComponent(entityId, MovedThisTurn, {
        fromX: oldX,
        fromY: oldY,
        toX: targetX,
        toY: targetY
      });

      // 3. Emit event for UI/Rendering (or specialized ENEMY_TELEPORTED if needed)
      // We use ENTITY_MOVED to ensure existing animation logic picks it up, 
      // but systems can check for TeleportIntent presence if they need to distinguish.
      eventBus.emit('ENTITY_MOVED', {
        entityId,
        fromX: oldX,
        fromY: oldY,
        toX: targetX,
        toY: targetY,
      });

      // 4. Cleanup
      w.removeComponent(entityId, TeleportIntent);
    }
  };

  return {
    init() {
      world.registerSystem(Phase.ACTION, update);
    },
    dispose() {
      world.unregisterSystem(Phase.ACTION, update);
    },
    update,
  };
}

export type TeleportSystem<T extends GameplayEvents = GameplayEvents> = ReturnType<typeof createTeleportSystem<T>>;
