import { World } from '@engine/ecs/world';
import { EventBus } from '@engine/events/event-bus';
import { Phase } from '@engine/ecs/types';
import { DealtDamageThisTurn, Dying } from '@shared/components';
import { GameplayEvents } from '@shared/events/types';
import { applyBleedOnHit, applyVampireOnKill } from './software-effects';

/**
 * System that resolves Software effects (like Bleed and Vampire)
 * by observing transient components and entity states in Phase.REACTION.
 * This decouples software resolution from the core CombatSystem.
 */
export function createSoftwareSystem<T extends GameplayEvents>(
  world: World<T>,
  eventBus: EventBus<T>
) {
  const update = (w: World<T>) => {
    // 1. Observe Damage Dealt (for Bleed)
    const attackers = w.query(DealtDamageThisTurn);
    for (const attackerId of attackers) {
      const dealtDamage = w.getComponent(attackerId, DealtDamageThisTurn)!;
      for (const defenderId of dealtDamage.targets) {
        applyBleedOnHit(w, eventBus, attackerId, defenderId);
      }
    }

    // 2. Observe Deaths (for Vampire)
    const dyingEntities = w.query(Dying);
    for (const dyingId of dyingEntities) {
      const dyingComp = w.getComponent(dyingId, Dying)!;
      if (dyingComp.killerId) {
        applyVampireOnKill(w, eventBus, dyingComp.killerId);
      }
    }
  };

  return {
    init() {
      world.registerSystem(Phase.REACTION, update);
    },
    dispose() {
      world.unregisterSystem(Phase.REACTION, update);
    },
    update,
  };
}

export type SoftwareSystem<T extends GameplayEvents = GameplayEvents> = ReturnType<typeof createSoftwareSystem<T>>;
