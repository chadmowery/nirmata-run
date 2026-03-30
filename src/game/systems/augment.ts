import { World } from '@engine/ecs/world';
import { EventBus } from '@engine/events/event-bus';
import { EntityId } from '@engine/ecs/types';
import { 
  AugmentData, 
  AugmentState, 
  AugmentSlots, 
  Health, 
  Heat, 
  ConditionNode,
  PayloadType 
} from '@shared/components';
import { GameplayEvents } from '@shared/events/types';
import { StatusEffectSystem } from './status-effects';
import { HeatSystem } from './heat';

interface TriggerContext {
  firmwareActivated: boolean;
  damageDealt: number;
  killCount: number;
  heatAboveMax: boolean;
  currentHeat: number;
  hpPercent: number;
}

export function createAugmentSystem<T extends GameplayEvents>(
  world: World<T>,
  eventBus: EventBus<T>,
  statusEffectSystem: StatusEffectSystem,
  heatSystem: HeatSystem,
) {
  let pendingContext: TriggerContext | null = null;
  let isResolving = false;

  const evaluateCondition = (node: ConditionNode, ctx: TriggerContext, depth: number = 0): boolean => {
    if (depth > 10) return false;

    switch (node.type) {
      case 'AND':
        return node.conditions?.every(c => evaluateCondition(c, ctx, depth + 1)) ?? true;
      case 'OR':
        return node.conditions?.some(c => evaluateCondition(c, ctx, depth + 1)) ?? false;
      case 'NOT':
        return node.conditions?.[0] ? !evaluateCondition(node.conditions[0], ctx, depth + 1) : true;
      case 'ON_ACTIVATION':
        return ctx.firmwareActivated;
      case 'ON_TARGET_HIT':
        return ctx.damageDealt > 0;
      case 'ON_OVERCLOCK':
        return ctx.heatAboveMax;
      case 'ON_KILL':
        return ctx.killCount > 0;
      case 'HEAT_ABOVE':
        return ctx.currentHeat >= (node.value ?? 0);
      case 'HP_BELOW_PERCENT':
        return ctx.hpPercent <= (node.value ?? 0);
      default:
        return false;
    }
  };

  const resolvePayloads = (entityId: EntityId, payloads: PayloadType[]) => {
    for (const payload of payloads) {
      switch (payload.type) {
        case 'HEAL': {
          const health = world.getComponent(entityId, Health);
          if (health) {
            health.current = Math.min(health.max, health.current + (payload.magnitude ?? 0));
          }
          break;
        }
        case 'SHIELD':
          statusEffectSystem.applyEffect(entityId, { 
            name: 'SHIELD', 
            duration: 1, 
            magnitude: payload.magnitude 
          });
          break;
        case 'APPLY_STATUS':
          if (payload.statusEffectName) {
            statusEffectSystem.applyEffect(entityId, { 
              name: payload.statusEffectName, 
              duration: payload.statusEffectDuration ?? 1, 
              magnitude: payload.magnitude 
            });
          }
          break;
        case 'VENT_HEAT':
          heatSystem.addHeat(entityId, -(payload.magnitude ?? 0));
          break;
        case 'DAMAGE_BONUS':
          statusEffectSystem.applyEffect(entityId, { 
            name: 'DAMAGE_BOOST', 
            duration: payload.statusEffectDuration ?? 1, 
            magnitude: payload.magnitude 
          });
          break;
      }
    }
  };

  const processTriggersForEntity = (entityId: EntityId, ctx: TriggerContext) => {
    const slots = world.getComponent(entityId, AugmentSlots);
    if (!slots) return;

    let state = world.getComponent(entityId, AugmentState);
    if (!state) {
      world.addComponent(entityId, AugmentState, { activationsThisTurn: {}, cooldownsRemaining: {} });
      state = world.getComponent(entityId, AugmentState)!;
    }

    const triggeredAugments: Array<{ name: string; payloadType: string; magnitude: number }> = [];

    for (const augmentId of slots.equipped) {
      const augmentData = world.getComponent(augmentId, AugmentData);
      if (!augmentData) continue;

      const augmentKey = augmentId.toString();
      const activations = state.activationsThisTurn[augmentKey] ?? 0;
      const cooldown = state.cooldownsRemaining[augmentKey] ?? 0;

      if (activations < augmentData.maxTriggersPerTurn && cooldown <= 0) {
        if (evaluateCondition(augmentData.trigger, ctx)) {
          resolvePayloads(entityId, augmentData.payloads);
          
          state.activationsThisTurn[augmentKey] = activations + 1;
          if (augmentData.cooldownTurns > 0) {
            state.cooldownsRemaining[augmentKey] = augmentData.cooldownTurns;
          }

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
        }
      }
    }

    if (triggeredAugments.length > 0) {
      eventBus.emit('AUGMENT_TRIGGERED', {
        entityId,
        augments: triggeredAugments
      });
    }
  };

  const resetTurnState = (entityId: EntityId) => {
    const state = world.getComponent(entityId, AugmentState);
    if (state) {
      state.activationsThisTurn = {};
      for (const key in state.cooldownsRemaining) {
        if (state.cooldownsRemaining[key] > 0) {
          state.cooldownsRemaining[key]--;
        }
      }
    }
  };

  const ensurePendingContext = (entityId: EntityId) => {
    if (!pendingContext) {
      const heat = world.getComponent(entityId, Heat);
      const health = world.getComponent(entityId, Health);
      pendingContext = {
        firmwareActivated: false,
        damageDealt: 0,
        killCount: 0,
        heatAboveMax: heat ? heat.current > heat.maxSafe : false,
        currentHeat: heat?.current ?? 0,
        hpPercent: health ? (health.current / health.max) * 100 : 100,
      };
    }
    return pendingContext;
  };

  const onFirmwareActivated = (event: GameplayEvents['FIRMWARE_ACTIVATED']) => {
    if (isResolving) return;
    const ctx = ensurePendingContext(event.entityId);
    ctx.firmwareActivated = true;
  };

  const onDamageDealt = (event: GameplayEvents['DAMAGE_DEALT']) => {
    if (isResolving) return;
    const ctx = ensurePendingContext(event.attackerId);
    ctx.damageDealt += event.amount;
  };

  const onEntityDied = (event: GameplayEvents['ENTITY_DIED']) => {
    if (isResolving) return;
    const ctx = ensurePendingContext(event.killerId);
    ctx.killCount++;
  };

  const onPlayerAction = (event: GameplayEvents['PLAYER_ACTION']) => {
    if (isResolving || !pendingContext) return;
    
    isResolving = true;
    processTriggersForEntity(event.entityId, pendingContext);
    pendingContext = null;
    isResolving = false;
  };

  const onTurnStart = () => {
    const entitiesWithState = world.query(AugmentState);
    for (const entityId of entitiesWithState) {
      resetTurnState(entityId);
    }
    pendingContext = null;
  };

  return {
    init() {
      eventBus.on('FIRMWARE_ACTIVATED', onFirmwareActivated);
      eventBus.on('DAMAGE_DEALT', onDamageDealt);
      eventBus.on('ENTITY_DIED', onEntityDied);
      eventBus.on('PLAYER_ACTION', onPlayerAction);
      eventBus.on('TURN_START', onTurnStart);
    },

    dispose() {
      eventBus.off('FIRMWARE_ACTIVATED', onFirmwareActivated);
      eventBus.off('DAMAGE_DEALT', onDamageDealt);
      eventBus.off('ENTITY_DIED', onEntityDied);
      eventBus.off('PLAYER_ACTION', onPlayerAction);
      eventBus.off('TURN_START', onTurnStart);
    },

    resetTurnState,
    evaluateCondition,
    resolvePayloads,
    processTriggersForEntity,
  };
}

export type AugmentSystem = ReturnType<typeof createAugmentSystem>;
