import { World } from '@engine/ecs/world';
import { EntityId, Phase } from '@engine/ecs/types';
import { Shell, Health, Defense, Energy, ShellUpdateTag } from '@shared/components';
import { EventBus } from '@engine/events/event-bus';
import { GameplayEvents } from '@shared/events/types';

/**
 * Syncs an entity's derived stats (Health, Defense, Energy) with its Shell component values.
 */
export function propagateShellStats(world: World<any>, entityId: EntityId): void {
  const shell = world.getComponent(entityId, Shell);
  if (!shell) return;

  // Update Health
  const health = world.getComponent(entityId, Health);
  if (health) {
    const healthDiff = shell.maxHealth - health.max;
    let nextCurrent = health.current;
    if (healthDiff > 0) {
      nextCurrent += healthDiff;
    }
    nextCurrent = Math.min(shell.maxHealth, nextCurrent);

    world.patchComponent(entityId, Health, {
      max: shell.maxHealth,
      current: nextCurrent
    });
  }

  // Update Defense
  if (world.hasComponent(entityId, Defense)) {
    world.patchComponent(entityId, Defense, { armor: shell.armor });
  }

  // Update Energy/Speed
  if (world.hasComponent(entityId, Energy)) {
    world.patchComponent(entityId, Energy, { speed: shell.speed });
  }
}

/**
 * The ShellStatsSystem manages re-synchronizing derived stats when a shell is updated.
 */
export function createShellStatsSystem<T extends GameplayEvents>(
  world: World<T>,
  eventBus: EventBus<T>
) {
  const update = (w: World<T>) => {
    const entities = w.query(ShellUpdateTag);
    for (const entityId of entities) {
      propagateShellStats(w, entityId);
      w.removeComponent(entityId, ShellUpdateTag);
    }
  };

  return {
    init() {
      world.registerSystem(Phase.PRE_TURN, update, 'ShellStatsSystem');
    },
    dispose() {
      world.unregisterSystem(Phase.PRE_TURN, update);
    },
    update,
  };
}

export type ShellStatsSystem<T extends GameplayEvents = GameplayEvents> = ReturnType<typeof createShellStatsSystem<T>>;
