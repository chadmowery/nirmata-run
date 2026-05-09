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
  const movement = createMovementSystem(world, grid, eventBus);
  const combat = createCombatSystem(world, grid, eventBus, entityFactory, componentRegistry, options);
  const itemPickup = createItemPickupSystem(world, grid, eventBus);

  movement.init();
  combat.init();
  itemPickup.init();
  
  const augment = createAugmentSystem(world, eventBus);
  augment.init();

  // Cleanup & Death Processing
  const gravedigger = createGravediggerSystem(world, grid);
  const rewardDrop = createRewardDropSystem(world, grid, eventBus, entityFactory, componentRegistry);
  const runEnder = createRunEnderSystem(world, grid, eventBus, options.runMode);

  rewardDrop.init();
  runEnder.init();
  
  // Gravedigger MUST be last in Phase.CLEANUP
  gravedigger.init();
  
  const tagCleanup = createTagCleanupSystem(world);
  tagCleanup.init();

  return { movement, combat, itemPickup, gravedigger, rewardDrop, runEnder, augment, tagCleanup };
}
