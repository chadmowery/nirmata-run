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
    health.max = shell.maxHealth;
    // If upgrading health, also increase current? 
    // Usually yes, at least by the diff.
    if (healthDiff > 0) {
      health.current += healthDiff;
    }
    // Ensure current doesn't exceed new max
    health.current = Math.min(health.max, health.current);
  }

  // Update Defense
  const defense = world.getComponent(entityId, Defense);
  if (defense) {
    defense.armor = shell.armor;
  }

  // Update Energy/Speed
  const energy = world.getComponent(entityId, Energy);
  if (energy) {
    energy.speed = shell.speed;
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
