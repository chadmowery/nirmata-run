import { World } from '@engine/ecs/world';
import { EntityId } from '@engine/ecs/types';
import {
  ConditionNode,
  Health,
  Heat,
  Dying,
  FirmwareActivatedThisTurn,
  DealtDamageThisTurn
} from '@shared/components';

export interface TriggerContext {
  firmwareActivated: boolean;
  damageDealt: number;
  killCount: number;
  heatAboveMax: boolean;
  currentHeat: number;
  hpPercent: number;
}

/**
 * Creates a TriggerContext for an entity based on its current ECS state.
 */
export function createTriggerContext(world: World<any>, entityId: EntityId): TriggerContext {
  const heat = world.getComponent(entityId, Heat);
  const health = world.getComponent(entityId, Health);
  const firmware = world.getComponent(entityId, FirmwareActivatedThisTurn);
  const dealtDamage = world.getComponent(entityId, DealtDamageThisTurn);
  
  // Count kills: find all Dying entities where killerId matches entityId
  const dyingEntities = world.query(Dying);
  let killCount = 0;
  for (const dyingId of dyingEntities) {
    if (world.getComponent(dyingId, Dying)?.killerId === entityId) {
      killCount++;
    }
  }

  return {
    firmwareActivated: !!firmware,
    damageDealt: dealtDamage?.amount ?? 0,
    killCount,
    heatAboveMax: heat ? heat.current > heat.maxSafe : false,
    currentHeat: heat?.current ?? 0,
    hpPercent: health ? (health.current / health.max) * 100 : 100,
  };
}

/**
 * Evaluates a condition node against a trigger context.
 */
export function evaluateCondition(node: ConditionNode, ctx: TriggerContext, depth: number = 0): boolean {
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
}
