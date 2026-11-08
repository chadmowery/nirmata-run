/**
 * Spawn Entity System
 * Authoritative Phase.ACTION system that resolves SpawnEntityIntent components
 * and registers spawned entities onto the spatial grid.
 */

import { World } from '@engine/ecs/world';
import { Grid } from '@engine/grid/grid';
import { EntityFactory } from '@engine/entity/factory';
import { ComponentRegistry } from '@engine/entity/types';
import { Phase } from '@engine/ecs/types';
import { SpawnEntityIntent } from '@shared/components/intents';
import { GameplayEvents } from '@shared/events/types';
import { logger } from '@engine/utils/logger';

export function createSpawnEntitySystem<T extends GameplayEvents>(
  world: World<T>,
  grid: Grid,
  entityFactory: EntityFactory,
  componentRegistry: ComponentRegistry,
) {
  let actionHandler: (() => void) | null = null;
  let postTurnHandler: (() => void) | null = null;

  function resolveSpawns(): void {
    const spawners = world.query(SpawnEntityIntent);
    for (const spawnerId of spawners) {
      const intent = world.getComponent(spawnerId, SpawnEntityIntent);
      if (!intent) continue;

      for (const spawn of intent.spawns) {
        if (!grid.inBounds(spawn.x, spawn.y)) {
          logger.warn(
            `SpawnEntitySystem: Coordinates (${spawn.x}, ${spawn.y}) out of bounds for template ${spawn.templateName}`,
            'SYSTEM',
          );
          continue;
        }

        try {
          const overrides = {
            position: { x: spawn.x, y: spawn.y },
            ...(spawn.overrides ?? {}),
          };

          const spawnedId = entityFactory.create(
            world,
            spawn.templateName,
            componentRegistry,
            overrides,
          );

          grid.addEntity(spawnedId, spawn.x, spawn.y);
          logger.debug(
            `SpawnEntitySystem: Spawned ${spawn.templateName} (ID: ${spawnedId}) at (${spawn.x}, ${spawn.y})`,
            'SYSTEM',
          );
        } catch (err) {
          logger.error(
            `SpawnEntitySystem: Failed to spawn ${spawn.templateName} at (${spawn.x}, ${spawn.y})`,
            'SYSTEM',
            { error: err },
          );
        }
      }

      world.removeComponent(spawnerId, SpawnEntityIntent);
    }
  }

  return {
    init() {
      actionHandler = () => resolveSpawns();
      postTurnHandler = () => resolveSpawns();

      world.registerSystem(Phase.ACTION, actionHandler, 'SpawnEntitySystem');
      world.registerSystem(Phase.POST_TURN, postTurnHandler, 'SpawnEntitySystemPostTurn');
    },
    dispose() {
      if (actionHandler) {
        world.unregisterSystem(Phase.ACTION, actionHandler);
        actionHandler = null;
      }
      if (postTurnHandler) {
        world.unregisterSystem(Phase.POST_TURN, postTurnHandler);
        postTurnHandler = null;
      }
    },
    resolveSpawns,
  };
}

export type SpawnEntitySystem<T extends GameplayEvents = GameplayEvents> = ReturnType<
  typeof createSpawnEntitySystem<T>
>;
