import { World } from '@engine/ecs/world';
import { EventBus } from '@engine/events/event-bus';
import { Health, Heat, Stability, Position, Actor } from '@shared/components';
import { EntityId } from '@engine/ecs/types';
import { GameplayEvents } from '@shared/events/types';
import { runInventoryRegistry } from '../systems/run-inventory';

export function handleServerDebugCommand(
  world: World<any>,
  eventBus: EventBus<GameplayEvents>,
  playerId: EntityId,
  sessionId: string,
  command: string,
  args: any = {}
) {
  if (process.env.NODE_ENV !== 'development') {
    console.warn(`[DEBUG] Attempted debug command "${command}" in non-development environment. Ignoring.`);
    return;
  }

  console.log(`[DEBUG-SERVER] Executing: ${command}`, args, `PlayerId: ${playerId}`);

  switch (command) {
    case 'SET_HEAT': {
      const amount = Number(args.amount);
      const heatComp = world.getComponent(playerId, Heat);
      if (heatComp) {
        const oldHeat = heatComp.current;
        heatComp.current = amount;
        console.log(`[DEBUG-SERVER] Updated Heat for entity ${playerId}: ${oldHeat} -> ${amount}`);
        eventBus.emit('HEAT_CHANGED', {
          entityId: playerId,
          oldHeat,
          newHeat: amount,
          maxSafe: heatComp.maxSafe,
        });
      } else {
        const allStores = world.getSerializableState().stores;
        const entityComponents = Object.keys(allStores).filter(k => allStores[k][playerId] !== undefined);
        console.warn(`[DEBUG-SERVER] Heat component NOT FOUND for entity ${playerId}. Entity has components:`, entityComponents);
        // Fallback: search for player entity manually if playerId is suspicious
        const playerEntities = world.query(Actor).filter(id => world.getComponent(id, Actor)?.isPlayer);
        console.log(`[DEBUG-SERVER] Player entities found in world:`, playerEntities);
      }
      break;
    }

    case 'TRIGGER_PANIC': {
      console.log(`[DEBUG-SERVER] Triggering Panic for ${playerId}`);
      eventBus.emit('KERNEL_PANIC_TRIGGERED', {
        entityId: playerId,
        tier: Number(args.tier) || 1,
        severity: args.severity || 'low',
        effectName: args.effectName || 'Debug Panic',
      });
      break;
    }

    case 'SET_HP': {
      const amount = Number(args.amount);
      const healthComp = world.getComponent(playerId, Health);
      if (healthComp) {
        const oldVal = healthComp.current;
        healthComp.current = amount;
        console.log(`[DEBUG-SERVER] Updated HP for entity ${playerId}: ${oldVal} -> ${amount}`);
        const diff = amount - oldVal;
        if (diff > 0) {
          eventBus.emit('HEALED', { entityId: playerId, amount: diff });
        } else if (diff < 0) {
          eventBus.emit('DAMAGE_DEALT', { 
            attackerId: playerId, 
            defenderId: playerId, 
            amount: Math.abs(diff) 
          });
        }
      } else {
        console.warn(`[DEBUG-SERVER] Health component NOT FOUND for entity ${playerId}`);
      }
      break;
    }

    case 'SET_STABILITY': {
      const amount = Number(args.amount);
      const stabilityComp = world.getComponent(playerId, Stability);
      if (stabilityComp) {
        const oldVal = stabilityComp.current;
        stabilityComp.current = amount;
        console.log(`[DEBUG-SERVER] Updated Stability for entity ${playerId}: ${oldVal} -> ${amount}`);
        eventBus.emit('STABILITY_CHANGED', {
          entityId: playerId,
          oldValue: oldVal,
          newValue: amount,
          reason: 'turn_bleed',
        });
      }
      break;
    }

    case 'GIVE_CURRENCY': {
      const type = args.type || 'scrap';
      const amount = Number(args.amount) || 100;
      console.log(`[DEBUG-SERVER] Giving ${amount} ${type} to session ${sessionId}`);
      
      // Update the authoritative registry
      runInventoryRegistry.addCurrency(sessionId, type as any, amount, {
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
      eventBus.emit('STATUS_EFFECT_APPLIED', {
        entityId: playerId,
        effectName: args.effectName || 'burning',
        duration: Number(args.duration) || 5,
        magnitude: 1,
        source: 'debug',
      });
      break;
    }

    case 'DESCEND': {
      eventBus.emit('STAIRCASE_DESCEND_TRIGGERED', {
        entityId: playerId,
        targetFloor: 2, // Arbitrary
        runSeed: 'debug',
      });
      break;
    }

    case 'SPAWN_DEADZONE': {
      const pos = world.getComponent(playerId, Position);
      if (pos) {
        eventBus.emit('DEAD_ZONE_CREATED', {
          x: pos.x,
          y: pos.y,
          duration: Number(args.duration) || 5,
          creatorId: playerId,
        });
      }
      break;
    }

    default:
      console.warn(`[DEBUG-SERVER] Unknown command: ${command}`);
  }
}
