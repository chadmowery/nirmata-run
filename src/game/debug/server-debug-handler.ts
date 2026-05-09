import { World } from '@engine/ecs/world';
import { EventBus } from '@engine/events/event-bus';
import { Health, Heat, Stability, Position, Actor, FloorState } from '@shared/components';
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
        world.patchComponent(playerId, Heat, { current: amount });
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
      const tier = Number(args.tier) || 1;
      const effectName = args.effectName || (tier === 1 ? 'HUD_GLITCH' : tier === 2 ? 'INPUT_LAG' : tier === 3 ? 'FIRMWARE_LOCK' : 'CRITICAL_REBOOT');
      const severity = args.severity || (tier === 1 ? 'minor' : tier === 2 ? 'moderate' : tier === 3 ? 'severe' : 'critical');
      const duration = tier === 4 ? 3 : 2;

      eventBus.emit('APPLY_STATUS_EFFECT', {
        entityId: playerId,
        effect: {
          name: effectName,
          duration,
          magnitude: 1,
          source: 'debug',
        }
      });

      eventBus.emit('KERNEL_PANIC_TRIGGERED', {
        entityId: playerId,
        tier,
        severity,
        effectName,
      });

      // Special case for Tier 4: critical reboot vents heat
      if (tier === 4) {
        const heatComp = world.getComponent(playerId, Heat);
        if (heatComp) {
          const oldHeat = heatComp.current;
          world.patchComponent(playerId, Heat, { current: 0 });
          eventBus.emit('HEAT_CHANGED', {
            entityId: playerId,
            oldHeat,
            newHeat: 0,
            maxSafe: heatComp.maxSafe,
          });
        }
      }
      break;
    }

    case 'SET_HP': {
      const amount = Number(args.amount);
      const healthComp = world.getComponent(playerId, Health);
      if (healthComp) {
        const oldVal = healthComp.current;
        world.patchComponent(playerId, Health, { current: amount });
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
        world.patchComponent(playerId, Stability, { current: amount });
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
      
      // Update the authoritative ECS components
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
      
      eventBus.emit('APPLY_STATUS_EFFECT', {
        entityId: playerId,
        effect: {
          name: effectName,
          duration,
          magnitude: 1,
          source: 'debug',
        }
      });
      break;
    }

    case 'DESCEND': {
      const count = Number(args.count) || 1;
      const floorState = world.getComponent(playerId, FloorState);
      const nextFloor = (floorState?.currentFloor ?? 1) + count;
      const seed = floorState?.runSeed ?? 'debug';
      
      console.log(`[DEBUG-SERVER] Forcing descent of ${count} floors to floor ${nextFloor} (Seed: ${seed})`);
      
      eventBus.emit('STAIRCASE_DESCEND_TRIGGERED', {
        entityId: playerId,
        targetFloor: nextFloor,
        runSeed: seed,
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

    case 'CLEAR_SESSIONS': {
      console.log(`[DEBUG-SERVER] Clearing all sessions from SessionManager`);
      sessionManager.clear();
      break;
    }

    default:
      console.warn(`[DEBUG-SERVER] Unknown command: ${command}`);
  }
}
