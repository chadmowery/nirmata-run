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
import { createUpkeepSystem } from './upkeep';
import { createFloorManagerSystem } from './floor-manager';
import { createPackCoordinatorSystem } from './pack-coordinator';
import { createStatusEffectSystem } from './status-effects';
import { createAnchorInteractionSystem } from './anchor-interaction';
import { RunMode } from '@shared/run-mode';
import { Phase } from '@engine/ecs/types';

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
  const movement = createMovementSystem(world, grid, eventBus);
  const combat = createCombatSystem(world, grid, eventBus, entityFactory, componentRegistry, options);
  const itemPickup = createItemPickupSystem(world, grid, eventBus);
  const stability = createStabilitySystem(world, eventBus);
  const deadZone = createDeadZoneSystem(world, grid, eventBus);
  const equipment = createEquipmentSystem(world, eventBus);
  const shellStats = createShellStatsSystem(world, eventBus);
  const statusEffect = createStatusEffectSystem(world, eventBus);
  const augment = createAugmentSystem(world, eventBus);
  const packCoordinator = createPackCoordinatorSystem(world, grid, eventBus);
  const upkeep = createUpkeepSystem(world, eventBus, statusEffect, augment, packCoordinator);

  // Floor manager is special but registered to cleanup
  const floorManager = createFloorManagerSystem(world, grid, eventBus, entityFactory, componentRegistry, options.runMode === RunMode.SIMULATION);

  // Anchor interaction handles descent/extraction intents
  // Note: We'll need a way to get turnManager if we want to pause it, but for now we'll pass null or refactor.
  // Actually, AnchorInteractionSystem currently needs turnManager.

  const anchorInteraction = createAnchorInteractionSystem(world, grid, eventBus);

  // Initialize systems in phased order
  // Pre-turn phase
  upkeep.init();
  shellStats.init();
  world.registerSystem(Phase.PRE_TURN, stability.update);

  // Action / Reaction
  movement.init();
  equipment.init();
  combat.init();
  itemPickup.init();
  deadZone.init();
  augment.init();
  anchorInteraction.init();

  // Cleanup & Death Processing
  const gravedigger = createGravediggerSystem(world, grid);
  const rewardDrop = createRewardDropSystem(world, grid, eventBus, entityFactory, componentRegistry);
  const runEnder = createRunEnderSystem(world, grid, eventBus, options.runMode);

  rewardDrop.init();
  runEnder.init();
  world.registerSystem(Phase.CLEANUP, floorManager.update);

  // Post-turn phase
  world.registerSystem(Phase.POST_TURN, deadZone.update);

  // Gravedigger MUST be last in Phase.CLEANUP
  gravedigger.init();

  const tagCleanup = createTagCleanupSystem(world);
  tagCleanup.init();

  return {
    movement, combat, itemPickup, gravedigger, rewardDrop, runEnder,
    augment, tagCleanup, stability, deadZone, equipment, shellStats, upkeep, floorManager, anchorInteraction,
    statusEffect, packCoordinator
  };
}
