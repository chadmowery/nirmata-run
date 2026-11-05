import { World } from '@engine/ecs/world';
import { EngineEvents } from '@engine/events/types';
import { EntityId } from '@engine/ecs/types';
import {
  ConditionNode,
  Health,
  Heat,
  Dying,
  FirmwareActivatedThisTurn,
  DealtDamageThisTurn,
  InteractiveSurface,
  PropInteractedThisTurn,
} from '@shared/components';

export interface TriggerContext {
  firmwareActivated: boolean;
  damageDealt: number;
  killCount: number;
  heatAboveMax: boolean;
  currentHeat: number;
  hpPercent: number;
  onHack?: boolean;
  onCoverBroken?: boolean;
}

/**
 * Creates a TriggerContext for an entity based on its current ECS state.
 */
export function createTriggerContext<T extends EngineEvents = EngineEvents>(
  world: World<T>,
  entityId: EntityId,
): TriggerContext {
  const heat = world.getComponent(entityId, Heat);
  const health = world.getComponent(entityId, Health);
  const firmware = world.getComponent(entityId, FirmwareActivatedThisTurn);
  const dealtDamage = world.getComponent(entityId, DealtDamageThisTurn);

  // Count kills: find all Dying entities where killerId matches entityId
  const dyingEntities = world.query(Dying);
  let killCount = 0;
  let onCoverBroken = false;
  for (const dyingId of dyingEntities) {
    const dying = world.getComponent(dyingId, Dying);
    if (dying?.killerId === entityId) {
      killCount++;
      if (
        dying.reason === 'environmental_destruction' ||
        dying.reason === 'destroyed' ||
        world.hasComponent(dyingId, InteractiveSurface)
      ) {
        onCoverBroken = true;
      }
    }
  }

  // Check onHack: transient PropInteractedThisTurn tagged on entityId or with interactedBy === entityId
  let onHack = !!world.getComponent(entityId, PropInteractedThisTurn);
  if (!onHack) {
    const allInteracted = world.query(PropInteractedThisTurn);
    for (const id of allInteracted) {
      if (world.getComponent(id, PropInteractedThisTurn)?.interactedBy === entityId) {
        onHack = true;
        break;
      }
    }
  }

  return {
    firmwareActivated: !!firmware,
    damageDealt: dealtDamage?.amount ?? 0,
    killCount,
    heatAboveMax: heat ? heat.current > heat.maxSafe : false,
    currentHeat: heat?.current ?? 0,
    hpPercent: health ? (health.current / health.max) * 100 : 100,
    onHack,
    onCoverBroken,
  };
}

/**
 * Evaluates a condition node against a trigger context.
 */
export function evaluateCondition(
  node: ConditionNode,
  ctx: TriggerContext,
  depth: number = 0,
): boolean {
  if (depth > 10) return false;

  switch (node.type) {
    case 'AND':
      return node.conditions?.every((c) => evaluateCondition(c, ctx, depth + 1)) ?? true;
    case 'OR':
      return node.conditions?.some((c) => evaluateCondition(c, ctx, depth + 1)) ?? false;
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
    case 'ON_HACK':
      return !!ctx.onHack;
    case 'ON_COVER_BROKEN':
      return !!ctx.onCoverBroken;
    default:
      return false;
  }
}
