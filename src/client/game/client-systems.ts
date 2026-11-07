import { World } from '@engine/ecs/world';
import { Grid } from '@engine/grid/grid';
import { EventBus } from '@engine/events/event-bus';
import { GameplayEvents } from '@shared/events/types';
import { createMovementSystem } from '@game/systems/movement';
import { createAugmentSystem } from '@game/systems/augment';
import { createTagCleanupSystem } from '@game/systems/tag-cleanup';
import { createEquipmentSystem } from '@game/systems/equipment';
import { createShellStatsSystem } from '@game/systems/shell-stats';
import { createAnchorInteractionSystem } from '@game/systems/anchor-interaction';
import { createSoftwareSystem } from '@game/systems/software';
import { createTeleportSystem } from '@game/systems/teleport';
import { createFirmwareSystem } from '@game/systems/firmware';

export interface ClientSystems<T extends GameplayEvents = GameplayEvents> {
  movement: ReturnType<typeof createMovementSystem<T>>;
  augment: ReturnType<typeof createAugmentSystem<T>>;
  tagCleanup: ReturnType<typeof createTagCleanupSystem<T>>;
  equipment: ReturnType<typeof createEquipmentSystem<T>>;
  shellStats: ReturnType<typeof createShellStatsSystem<T>>;
  anchorInteraction: ReturnType<typeof createAnchorInteractionSystem<T>>;
  teleport: ReturnType<typeof createTeleportSystem<T>>;
  software: ReturnType<typeof createSoftwareSystem<T>>;
  firmware: ReturnType<typeof createFirmwareSystem<T>>;
}

/**
 * Registers ONLY prediction-safe systems needed by the client.
 * Zero server systems (combat, ai, loot, procgen, gravedigger) are imported or initialized.
 */
export function registerClientSystems<T extends GameplayEvents>(
  world: World<T>,
  grid: Grid,
  eventBus: EventBus<T>,
): ClientSystems<T> {
  const shellStats = createShellStatsSystem(world);
  const teleport = createTeleportSystem(world, grid, eventBus);
  const movement = createMovementSystem(world, grid, eventBus, true);
  const equipment = createEquipmentSystem(world, eventBus);
  const anchorInteraction = createAnchorInteractionSystem(world, grid, eventBus);
  const firmware = createFirmwareSystem(world, grid, eventBus);
  const augment = createAugmentSystem(world, eventBus);
  const software = createSoftwareSystem(world, eventBus);
  const tagCleanup = createTagCleanupSystem(world);

  // Initialize prediction-safe systems into their phase slots
  shellStats.init();
  teleport.init();
  movement.init();
  equipment.init();
  anchorInteraction.init();
  firmware.init();
  augment.init();
  software.init();
  tagCleanup.init();

  return {
    shellStats,
    teleport,
    movement,
    equipment,
    anchorInteraction,
    firmware,
    augment,
    software,
    tagCleanup,
  };
}
