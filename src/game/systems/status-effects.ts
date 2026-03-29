import { World } from '@engine/ecs/world';
import { EventBus } from '@engine/events/event-bus';
import { EntityId } from '@engine/ecs/types';
import { StatusEffects, Actor } from '@shared/components';
import { GameplayEvents } from '@shared/events/types';

/**
 * Status effect system that manages timed effects on entities.
 */
export function createStatusEffectSystem<T extends GameplayEvents>(
  world: World<T>,
  eventBus: EventBus<T>,
) {
  const tickDown = (entityId: EntityId) => {
    const statusEffects = world.getComponent(entityId, StatusEffects);
    if (!statusEffects) return;

    const remainingEffects = [];
    for (const effect of statusEffects.effects) {
      effect.duration -= 1;
      if (effect.duration > 0) {
        remainingEffects.push(effect);
      } else {
        eventBus.emit('MESSAGE_EMITTED', {
          text: `${effect.name} has worn off.`,
          type: 'info',
        });
      }
    }

    statusEffects.effects = remainingEffects;
  };

  const applyEffect = (
    entityId: EntityId,
    effect: { name: string; duration: number; magnitude?: number; source?: string },
  ) => {
    let statusEffects = world.getComponent(entityId, StatusEffects);
    if (!statusEffects) {
      world.addComponent(entityId, StatusEffects, { effects: [] });
      statusEffects = world.getComponent(entityId, StatusEffects)!;
    }

    statusEffects.effects.push({
      name: effect.name,
      duration: effect.duration,
      magnitude: effect.magnitude ?? 0,
      source: effect.source,
    });

    eventBus.emit('MESSAGE_EMITTED', {
      text: `Afflicted by ${effect.name}!`,
      type: 'info',
    });
  };

  const hasEffect = (entityId: EntityId, name: string): boolean => {
    const statusEffects = world.getComponent(entityId, StatusEffects);
    return statusEffects ? statusEffects.effects.some(e => e.name === name) : false;
  };

  const getEffect = (entityId: EntityId, name: string) => {
    const statusEffects = world.getComponent(entityId, StatusEffects);
    return statusEffects ? statusEffects.effects.find(e => e.name === name) : undefined;
  };

  const onTurnStart = () => {
    const actors = world.query(Actor).filter(id => world.getComponent(id, Actor)?.isPlayer);
    for (const actorId of actors) {
      tickDown(actorId);
    }
  };

  return {
    init() {
      eventBus.on('TURN_START', onTurnStart);
    },

    dispose() {
      eventBus.off('TURN_START', onTurnStart);
    },

    tickDown,
    applyEffect,
    hasEffect,
    getEffect,
  };
}

export type StatusEffectSystem = ReturnType<typeof createStatusEffectSystem>;
