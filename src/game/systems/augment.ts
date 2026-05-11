import { World } from '@engine/ecs/world';
import { EventBus } from '@engine/events/event-bus';
import { EntityId, Phase } from '@engine/ecs/types';
import { logger } from '@engine/utils/logger';
import {
  AugmentData,
  AugmentState,
  AugmentSlots,
  HealIntent,
  HeatIntent,
  ApplyStatusEffectIntent
} from '@shared/components';
import { GameplayEvents } from '@shared/events/types';
import { getLegacyMagnitude } from './legacy-code';
import { createTriggerContext, evaluateCondition } from './augment-util';
import { applyStatusEffect } from './status-effects';

export function createAugmentSystem<T extends GameplayEvents>(
  world: World<T>,
  eventBus: EventBus<T>,
) {
  const resolvePayloads = (entityId: EntityId, payloads: any[], isLegacy: boolean = false) => {
    for (const payload of payloads) {
      const magnitude = getLegacyMagnitude(payload.magnitude ?? 0, isLegacy);

      switch (payload.type) {
        case 'HEAL': {
          const existing = world.getComponent(entityId, HealIntent);
          const currentAmount = existing?.amount ?? 0;
          world.addComponent(entityId, HealIntent, {
            targetId: entityId,
            amount: currentAmount + magnitude
          });
          break;
        }
        case 'SHIELD':
          // Status effects can overwrite for now as they usually don't stack magnitude
          world.addComponent(entityId, ApplyStatusEffectIntent, {
            targetId: entityId,
            effect: {
              name: 'SHIELD',
              duration: 1,
              magnitude: magnitude,
            }
          });
          break;
        case 'APPLY_STATUS':
          if (payload.statusEffectName) {
            world.addComponent(entityId, ApplyStatusEffectIntent, {
              targetId: entityId,
              effect: {
                name: payload.statusEffectName,
                duration: payload.statusEffectDuration ?? 1,
                magnitude: magnitude,
              }
            });
          }
          break;
        case 'VENT_HEAT': {
          const existing = world.getComponent(entityId, HeatIntent);
          const currentAmount = existing?.amount ?? 0;
          world.addComponent(entityId, HeatIntent, {
            targetId: entityId,
            amount: currentAmount - magnitude
          });
          break;
        }
        case 'DAMAGE_BONUS':
          // Handled directly in combat.ts for immediate resolution.
          // But we still apply the status effect for duration-based bonuses if needed.
          // If the payload has statusEffectDuration > 0, it means it should persist.
          if (payload.statusEffectDuration && payload.statusEffectDuration > 0) {
            applyStatusEffect(world, eventBus, entityId, {
              name: 'DAMAGE_BOOST',
              duration: payload.statusEffectDuration,
              magnitude: magnitude,
            });
          }
          break;
      }
    }
  };

  const processTriggersForEntity = (entityId: EntityId) => {
    const slots = world.getComponent(entityId, AugmentSlots);
    if (!slots) return;

    let state = world.getComponent(entityId, AugmentState);
    if (!state) {
      world.addComponent(entityId, AugmentState, { activationsThisTurn: {}, cooldownsRemaining: {} });
      state = world.getComponent(entityId, AugmentState)!;
    }

    const ctx = createTriggerContext(world, entityId);
    const triggeredAugments: Array<{ name: string; payloadType: string; magnitude: number }> = [];

    for (const augmentId of slots.equipped) {
      const augmentData = world.getComponent(augmentId, AugmentData);
      if (!augmentData) continue;

      const augmentKey = augmentId.toString();
      const activations = state.activationsThisTurn[augmentKey] ?? 0;
      const cooldown = state.cooldownsRemaining[augmentKey] ?? 0;

      if (activations < augmentData.maxTriggersPerTurn && cooldown <= 0) {
        if (evaluateCondition(augmentData.trigger, ctx)) {
          resolvePayloads(entityId, augmentData.payloads, augmentData.isLegacy);

          const nextActivations = {
            ...state.activationsThisTurn,
            [augmentKey]: activations + 1
          };
          const nextCooldowns = { ...state.cooldownsRemaining };
          if (augmentData.cooldownTurns > 0) {
            nextCooldowns[augmentKey] = augmentData.cooldownTurns;
          }

          world.patchComponent(entityId, AugmentState, {
            activationsThisTurn: nextActivations,
            cooldownsRemaining: nextCooldowns
          });

          for (const p of augmentData.payloads) {
            triggeredAugments.push({
              name: augmentData.name,
              payloadType: p.type,
              magnitude: p.magnitude ?? 0
            });
          }

          eventBus.emit('MESSAGE_EMITTED', {
            text: `${augmentData.name} TRIGGERED!`,
            type: 'info'
          });

          logger.info(`Augment ${augmentData.name} triggered for entity ${entityId}`, 'SYSTEM', { 
            payloads: augmentData.payloads 
          });
        }
      }
    }
  };

  const update = (w: World<T>) => {
    // Process all entities with AugmentSlots
    const entities = w.query(AugmentSlots);
    for (const entityId of entities) {
      processTriggersForEntity(entityId);
    }
  };

  const resetTurnState = (entityId: EntityId) => {
    const state = world.getComponent(entityId, AugmentState);
    if (state) {
      const nextCooldowns = { ...state.cooldownsRemaining };
      for (const key in nextCooldowns) {
        if (nextCooldowns[key] > 0) {
          nextCooldowns[key]--;
        }
      }

      world.patchComponent(entityId, AugmentState, {
        activationsThisTurn: {},
        cooldownsRemaining: nextCooldowns
      });
    }
  };
  const preTurnUpdate = (w: World<T>) => {
    const entities = w.query(AugmentState);
    for (const entityId of entities) {
      resetTurnState(entityId);
    }
  };

  return {
    init() {
      world.registerSystem(Phase.PRE_TURN, preTurnUpdate, 'AugmentPreTurnSystem');
      world.registerSystem(Phase.REACTION, update, 'AugmentReactionSystem');
    },

    dispose() {
      world.unregisterSystem(Phase.PRE_TURN, preTurnUpdate);
      world.unregisterSystem(Phase.REACTION, update);
    },

    update,
    preTurnUpdate,
    resetTurnState,
    evaluateCondition, // Keep for backward compat or tests
    resolvePayloads,
    processTriggersForEntity,
  };
}

export type AugmentSystem<T extends GameplayEvents = GameplayEvents> = ReturnType<typeof createAugmentSystem<T>>;
