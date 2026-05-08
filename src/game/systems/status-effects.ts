import { World } from '@engine/ecs/world';
import { EventBus } from '@engine/events/event-bus';
import { EntityId } from '@engine/ecs/types';
import { StatusEffects } from '@shared/components';
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
      const nextDuration = effect.duration - 1;
      if (nextDuration > 0) {
        remainingEffects.push({ ...effect, duration: nextDuration });
      } else {
        eventBus.emit('STATUS_EFFECT_EXPIRED', {
          entityId,
          effectName: effect.name,
        });

        eventBus.emit('MESSAGE_EMITTED', {
          text: `${effect.name} has worn off.`,
          type: 'info',
        });
      }
    }

    world.patchComponent(entityId, StatusEffects, { effects: remainingEffects });
  };

  const applyEffect = (
    entityId: EntityId,
    effect: { name: string; duration: number; magnitude?: number; severity?: string; source?: string },
  ) => {
    console.log(`[StatusEffectSystem] Applying ${effect.name} to entity ${entityId} (Duration: ${effect.duration}, Source: ${effect.source ?? 'unknown'})`);
    let statusEffects = world.getComponent(entityId, StatusEffects);
    if (!statusEffects) {
      world.addComponent(entityId, StatusEffects, { effects: [] });
      statusEffects = world.getComponent(entityId, StatusEffects)!;
    }

    const newEffect = {
      name: effect.name,
      duration: effect.duration,
      magnitude: effect.magnitude ?? 0,
      severity: effect.severity,
      source: effect.source,
    };

    world.patchComponent(entityId, StatusEffects, {
      effects: [...statusEffects.effects, newEffect]
    });

    eventBus.emit('STATUS_EFFECT_APPLIED', {
      entityId,
      effectName: newEffect.name,
      duration: newEffect.duration,
      magnitude: newEffect.magnitude,
      severity: newEffect.severity,
      source: newEffect.source ?? 'unknown',
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

  const getMagnitude = (entityId: EntityId, name: string): number => {
    const statusEffects = world.getComponent(entityId, StatusEffects);
    if (!statusEffects) return 0;
    const matching = statusEffects.effects.filter(e => e.name === name);
    if (matching.length === 0) return 0;
    return Math.max(...matching.map(e => e.magnitude));
  };

  const getEffectiveCount = (entityId: EntityId, name: string): number => {
    const statusEffects = world.getComponent(entityId, StatusEffects);
    if (!statusEffects) return 0;
    return statusEffects.effects.filter(e => e.name === name).length;
  };

  const getTotalMagnitude = (entityId: EntityId, name: string): number => {
    const statusEffects = world.getComponent(entityId, StatusEffects);
    if (!statusEffects) return 0;
    return statusEffects.effects
      .filter(e => e.name === name)
      .reduce((sum, e) => sum + e.magnitude, 0);
  };

  return {
    init() {
      eventBus.on('APPLY_STATUS_EFFECT', onApplyEffectRequested);
    },

    dispose() {
      eventBus.off('APPLY_STATUS_EFFECT', onApplyEffectRequested);
    },

    tickDown,
    applyEffect,
    hasEffect,
    getEffect,
    getMagnitude,
    getEffectiveCount,
    getTotalMagnitude,
  };

  function onApplyEffectRequested(payload: T['APPLY_STATUS_EFFECT']) {
    applyEffect(payload.entityId, payload.effect);
  }
}

export type StatusEffectSystem = ReturnType<typeof createStatusEffectSystem>;
