import { World } from '@engine/ecs/world';
import { Phase } from '@engine/ecs/types';
import { EventBus } from '@engine/events/event-bus';
import { GameplayEvents } from '@shared/events/types';
import { StatusEffects, AugmentState } from '@shared/components';
import { StatusEffectSystem } from './status-effects';
import { AugmentSystem } from './augment';
import { PackCoordinatorSystem } from './pack-coordinator';

/**
 * The UpkeepSystem handles per-turn maintenance logic such as status effect decay
 * and ability cooldown resets. It runs at the start of each global turn.
 */
export function createUpkeepSystem<T extends GameplayEvents>(
  world: World<T>,
  eventBus: EventBus<T>,
  statusEffectSystem: StatusEffectSystem<T>,
  augmentSystem: AugmentSystem<T>,
  packCoordinatorSystem: PackCoordinatorSystem<T>
) {
  const update = (w: World<T>) => {
    // 1. Tick down status effects for all entities
    const entitiesWithEffects = w.query(StatusEffects);
    for (const entityId of entitiesWithEffects) {
      statusEffectSystem.tickDown(entityId);
    }

    // 2. Reset augment trigger counts and tick down cooldowns
    const entitiesWithAugments = w.query(AugmentState);
    for (const entityId of entitiesWithAugments) {
      augmentSystem.resetTurnState(entityId);
    }

    // 3. Reset pack detonation state
    packCoordinatorSystem.resetTurnState();

    // 4. Any other per-turn global cleanup
  };

  return {
    init() {
      world.registerSystem(Phase.PRE_TURN, update);
    },
    dispose() {
      world.unregisterSystem(Phase.PRE_TURN, update);
    },
    update,
  };
}

export type UpkeepSystem<T extends GameplayEvents = GameplayEvents> = ReturnType<typeof createUpkeepSystem<T>>;
