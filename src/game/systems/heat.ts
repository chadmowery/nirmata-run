import { World } from '@engine/ecs/world';
import { EventBus } from '@engine/events/event-bus';
import { EntityId, Phase } from '@engine/ecs/types';
import { Heat, Shell, FirmwareSlots, AbilityDef, Actor, VentIntent, HeatIntent } from '@shared/components';
import { GameplayEvents } from '@shared/events/types';
import { logger } from '@engine/utils/logger';

/**
 * Heat system that manages entity heat dissipation and venting.
 */
export function createHeatSystem<T extends GameplayEvents>(
  world: World<T>,
  eventBus: EventBus<T>,
) {
  const dissipate = (entityId: EntityId) => {
    const heat = world.getComponent(entityId, Heat);
    const shell = world.getComponent(entityId, Shell);

    if (!heat) return;

    const oldHeat = heat.current;
    const stability = shell?.stability ?? 0;
    const effectiveDissipation = heat.baseDissipation + stability * 0.5;

    let nextHeat = Math.max(0, heat.current - effectiveDissipation);

    // Handle heatPerTurn for active toggle abilities
    const slots = world.getComponent(entityId, FirmwareSlots);
    if (slots) {
      for (const firmwareId of slots.equipped) {
        const abilityDef = world.getComponent(firmwareId, AbilityDef);
        if (abilityDef && abilityDef.isActive && abilityDef.heatPerTurn > 0) {
          nextHeat += abilityDef.heatPerTurn;
        }
      }
    }

    if (nextHeat !== oldHeat || heat.isVenting) {
      logger.debug(`Dissipating Heat for ${entityId}: ${oldHeat} -> ${nextHeat}`, 'HEAT');
      world.patchComponent(entityId, Heat, {
        current: nextHeat,
        isVenting: false
      });

      eventBus.emit('HEAT_CHANGED', {
        entityId,
        oldHeat,
        newHeat: nextHeat,
        maxSafe: heat.maxSafe,
      });
    }
  };

  const addHeat = (entityId: EntityId, amount: number) => {
    const heat = world.getComponent(entityId, Heat);
    if (!heat) return;

    const oldHeat = heat.current;
    const nextHeat = oldHeat + amount;

    logger.info(`Add Heat: Entity ${entityId} +${amount} -> ${nextHeat}`, 'HEAT');

    world.patchComponent(entityId, Heat, { current: nextHeat });

    eventBus.emit('HEAT_CHANGED', {
      entityId,
      oldHeat,
      newHeat: nextHeat,
      maxSafe: heat.maxSafe,
    });
  };

  const vent = (entityId: EntityId) => {
    const heat = world.getComponent(entityId, Heat);
    if (!heat) return;

    const oldHeat = heat.current;
    const nextHeat = Math.floor(oldHeat * (1 - heat.ventPercentage));

    logger.info(`Venting: Entity ${entityId} ${oldHeat} -> ${nextHeat}`, 'HEAT');

    world.patchComponent(entityId, Heat, {
      current: nextHeat,
      isVenting: true
    });

    eventBus.emit('VENT_COMPLETED', {
      entityId,
      oldHeat,
      newHeat: nextHeat,
    });

    eventBus.emit('HEAT_CHANGED', {
      entityId,
      oldHeat,
      newHeat: nextHeat,
      maxSafe: heat.maxSafe,
    });

    eventBus.emit('MESSAGE_EMITTED', {
      text: 'You vent excess Heat. Defense reduced until next turn.',
      type: 'info',
    });
  };

  const updatePreTurn = (w: World<T>) => {
    const players = w.query(Actor).filter(id => w.getComponent(id, Actor)?.isPlayer);
    for (const playerId of players) {
      dissipate(playerId);
    }
  };

  const updateAction = (w: World<T>) => {
    // 1. Process VentIntent
    const venters = w.query(VentIntent);
    for (const entityId of venters) {
      vent(entityId);
      w.removeComponent(entityId, VentIntent);
    }

    // 2. Process HeatIntent
    const heaters = w.query(HeatIntent);
    for (const entityId of heaters) {
      const intent = w.getComponent(entityId, HeatIntent)!;
      addHeat(intent.targetId, intent.amount);
      w.removeComponent(entityId, HeatIntent);
    }
  };

  return {
    init() {
      world.registerSystem(Phase.PRE_TURN, updatePreTurn, 'HeatPreTurnSystem');
      world.registerSystem(Phase.ACTION, updateAction, 'HeatActionSystem');
    },

    dispose() {
      world.unregisterSystem(Phase.PRE_TURN, updatePreTurn);
      world.unregisterSystem(Phase.ACTION, updateAction);
    },

    dissipate,
    addHeat,
    vent,
    isInCorruptionZone: (entityId: EntityId) => {
      const heat = world.getComponent(entityId, Heat);
      return heat ? heat.current > heat.maxSafe : false;
    },
    getHeatPercentage: (entityId: EntityId) => {
      const heat = world.getComponent(entityId, Heat);
      return heat ? (heat.current / heat.maxSafe) * 100 : 0;
    },
  };
}

export type HeatSystem<T extends GameplayEvents = GameplayEvents> = ReturnType<typeof createHeatSystem<T>>;
