import { World } from '@engine/ecs/world';
import { EntityId } from '@engine/ecs/types';
import { Shell, Health, Defense, Energy } from '@shared/components';
import { EventBus } from '@engine/events/event-bus';
import { GameplayEvents } from '@shared/events/types';

/**
 * Syncs an entity's derived stats (Health, Defense, Energy) with its Shell component values.
 */
export function propagateShellStats(world: World<GameplayEvents>, entityId: EntityId): void {
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
 * Registers listeners for shell changes.
 */
export function initShellStatsSystem(world: World<GameplayEvents>, eventBus: EventBus<GameplayEvents>): void {
  eventBus.on('SHELL_STATS_CHANGED', (payload) => {
    propagateShellStats(world, payload.entityId);
  });
}
