import { World } from '@engine/ecs/world';
import { EventBus } from '@engine/events/event-bus';
import { logger } from '@engine/utils/logger';
import { Health, Heat, Stability, Position, FloorState, DescentIntent, HeatIntent, ApplyStatusEffectIntent, HealIntent, DamageIntent, VentIntent } from '@shared/components';
import { EntityId } from '@engine/ecs/types';
import { GameplayEvents } from '@shared/events/types';
import * as InventoryUtil from '@shared/utils/inventory-util';
import { sessionManager } from '@engine/session/SessionManager';

export function handleServerDebugCommand(
  world: World<any>,
  eventBus: EventBus<GameplayEvents>,
  playerId: EntityId,
  sessionId: string,
  command: string,
  args: any = {},
  systems?: any
) {
  if (process.env.NODE_ENV !== 'development') {
    logger.warn(`Attempted debug command "${command}" in non-development environment. Ignoring.`, 'DEBUG');
    return;
  }

  logger.debug(`Executing: ${command} with args ${JSON.stringify(args)} (PlayerId: ${playerId})`, 'DEBUG');

  switch (command) {
    case 'SET_HEAT': {
      const amount = Number(args.amount);
      const heatComp = world.getComponent(playerId, Heat);
      if (heatComp) {
        const diff = amount - heatComp.current;
        world.addComponent(playerId, HeatIntent, { targetId: playerId, amount: diff });
        logger.debug(`Queued HeatIntent for entity ${playerId}: ${diff}`, 'DEBUG');
      }
      break;
    }

    case 'TRIGGER_PANIC': {
      logger.debug(`Triggering Panic for ${playerId}`, 'DEBUG');
      const tier = Number(args.tier) || 1;
      const effectName = args.effectName || (tier === 1 ? 'HUD_GLITCH' : tier === 2 ? 'INPUT_LAG' : tier === 3 ? 'FIRMWARE_LOCK' : 'CRITICAL_REBOOT');

      world.addComponent(playerId, ApplyStatusEffectIntent, {
        targetId: playerId,
        effect: {
          name: effectName,
          duration: tier === 4 ? 3 : 2,
          magnitude: 1,
          source: 'debug'
        }
      });

      // Special case for Tier 4: critical reboot vents heat
      if (tier === 4) {
        world.addComponent(playerId, VentIntent, {});
      }
      break;
    }

    case 'SET_HP': {
      const amount = Number(args.amount);
      const healthComp = world.getComponent(playerId, Health);
      if (healthComp) {
        const diff = amount - healthComp.current;
        if (diff > 0) {
          world.addComponent(playerId, HealIntent, { targetId: playerId, amount: diff });
        } else if (diff < 0) {
          world.addComponent(playerId, DamageIntent, { targetId: playerId, amount: Math.abs(diff) });
        }
        logger.debug(`Queued Health Intent for entity ${playerId}: ${diff}`, 'DEBUG');
      }
      break;
    }

    case 'SET_STABILITY': {
      // HACK: Stability doesn't have an intent yet, but it's a simple stat update.
      // However, for consistency, we'll keep direct patch for now or consider StabilityIntent.
      // Given the scope, let's keep it simple or add StabilityIntent.
      // Let's stick to the ones we have.
      const amount = Number(args.amount);
      world.patchComponent(playerId, Stability, { current: amount });
      break;
    }

    case 'GIVE_CURRENCY': {
      const type = args.type || 'scrap';
      const amount = Number(args.amount) || 100;
      InventoryUtil.addCurrency(world, playerId, type as any, amount, {
        blueprintId: args.blueprintId
      });
      eventBus.emit('CURRENCY_PICKED_UP', {
        entityId: playerId,
        currencyType: type as any,
        amount,
        blueprintId: args.blueprintId,
      });
      break;
    }

    case 'STATUS': {
      const effectName = args.effectName || 'burning';
      const duration = Number(args.duration) || 5;

      world.addComponent(playerId, ApplyStatusEffectIntent, {
        targetId: playerId,
        effect: {
          name: effectName,
          duration,
          magnitude: 1,
          source: 'debug'
        }
      });
      break;
    }

    case 'DESCEND': {
      const count = Number(args.count) || 1;
      const floorState = world.getComponent(playerId, FloorState);
      const nextFloor = (floorState?.currentFloor ?? 1) + count;

      world.addComponent(playerId, DescentIntent, {
        targetFloor: nextFloor,
        cost: 0
      });
      break;
    }

    case 'SPAWN_DEADZONE': {
      const pos = world.getComponent(playerId, Position);
      if (pos && systems?.deadZone) {
        systems.deadZone.createDeadZone(
          pos.x,
          pos.y,
          Number(args.duration) || 5,
          playerId
        );
      }
      break;
    }

    case 'CLEAR_SESSIONS': {
      sessionManager.clear();
      break;
    }

    default:
      logger.warn(`Unknown command: ${command}`, 'DEBUG');
  }
}
