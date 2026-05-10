import { World } from '@engine/ecs/world';
import { Grid } from '@engine/grid/grid';
import { EventBus } from '@engine/events/event-bus';
import { EntityFactory } from '@engine/entity/factory';
import { ComponentRegistry } from '@engine/entity/types';
import { GameplayEvents } from '@shared/events/types';
import { createMovementSystem } from './movement';
import { createCombatSystem } from './combat';
import { createItemPickupSystem } from './item-pickup';
import { createGravediggerSystem } from './gravedigger';
import { createRewardDropSystem } from './reward-drop';
import { createRunEnderSystem } from './run-ender';
import { createAugmentSystem } from './augment';
import { createTagCleanupSystem } from './tag-cleanup';
import { createStabilitySystem } from './stability';
import { createDeadZoneSystem } from './dead-zone';
import { createEquipmentSystem } from './equipment';
import { createShellStatsSystem } from './shell-stats';
import { createFloorManagerSystem } from './floor-manager';
import { createPackCoordinatorSystem } from './pack-coordinator';
import { createStatusEffectSystem } from './status-effects';
import { createAnchorInteractionSystem } from './anchor-interaction';
import { createSoftwareSystem } from './software';
import { createTeleportSystem } from './teleport';
import { createAISystem } from './ai';
import { createFirmwareSystem } from './firmware';
import { createTileCorruptionSystem } from './tile-corruption';
import { RunMode } from '@shared/run-mode';

/**
 * Registers core gameplay systems that must run in both client/server and pipeline simulations.
 * This ensures that intent resolution logic is identical across all execution contexts.
 */
export function registerCoreSystems<T extends GameplayEvents>(
  world: World<T>,
  grid: Grid,
  eventBus: EventBus<T>,
  entityFactory: EntityFactory,
  componentRegistry: ComponentRegistry,
  options: { skipLoot?: boolean; runMode?: RunMode } = {}
) {
  const teleport = createTeleportSystem(world, grid, eventBus);
  const movement = createMovementSystem(world, grid, eventBus);
  const combat = createCombatSystem(world, grid, eventBus, entityFactory, componentRegistry, options);
  const itemPickup = createItemPickupSystem(world, grid, eventBus);
  const stability = createStabilitySystem(world, eventBus);
  const deadZone = createDeadZoneSystem(world, grid, eventBus);
  const equipment = createEquipmentSystem(world, eventBus);
  const shellStats = createShellStatsSystem(world, eventBus);
  const statusEffect = createStatusEffectSystem(world, eventBus);
  const augment = createAugmentSystem(world, eventBus);
  const software = createSoftwareSystem(world, eventBus);
  const packCoordinator = createPackCoordinatorSystem(world, grid, eventBus);
  const ai = createAISystem(world, grid, eventBus, entityFactory, componentRegistry);
  const firmware = createFirmwareSystem(world, grid, eventBus);
  const tileCorruption = createTileCorruptionSystem(world, grid, eventBus, entityFactory, componentRegistry);

  // Floor manager is special but registered to cleanup
  const floorManager = createFloorManagerSystem(world, grid, eventBus, entityFactory, componentRegistry, options.runMode === RunMode.SIMULATION);

  const anchorInteraction = createAnchorInteractionSystem(world, grid, eventBus);

  // Initialize systems in phased order
  // Pre-turn phase
  shellStats.init();
  stability.init();

  // Action / Reaction
  teleport.init();
  movement.init();
  equipment.init();
  combat.init();
  itemPickup.init();
  deadZone.init();
  augment.init();
  software.init();
  statusEffect.init();
  packCoordinator.init();
  anchorInteraction.init();
  ai.init();
  firmware.init();
  tileCorruption.init();

  // Cleanup & Death Processing
  const gravedigger = createGravediggerSystem(world, grid);
  const rewardDrop = createRewardDropSystem(world, grid, eventBus, entityFactory, componentRegistry);
  const runEnder = createRunEnderSystem(world, grid, eventBus, options.runMode);

  rewardDrop.init();
  runEnder.init();
  floorManager.init();

  // Gravedigger MUST be last in Phase.CLEANUP
  gravedigger.init();

  const tagCleanup = createTagCleanupSystem(world);
  tagCleanup.init();

  return {
    movement, combat, itemPickup, gravedigger, rewardDrop, runEnder,
    augment, tagCleanup, stability, deadZone, equipment, shellStats, floorManager, anchorInteraction,
    statusEffect, packCoordinator, teleport, software
  };
}
