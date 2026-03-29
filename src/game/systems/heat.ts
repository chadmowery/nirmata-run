import { World } from '@engine/ecs/world';
import { EventBus } from '@engine/events/event-bus';
import { EntityId } from '@engine/ecs/types';
import { Heat, Shell, FirmwareSlots, AbilityDef, Actor } from '@shared/components';
import { GameplayEvents } from '@shared/events/types';

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

    // Reduce heat by dissipation
    heat.current = Math.max(0, heat.current - effectiveDissipation);

    // If venting, clear the flag
    if (heat.isVenting) {
      heat.isVenting = false;
    }

    // Handle heatPerTurn for active toggle abilities
    const slots = world.getComponent(entityId, FirmwareSlots);
    if (slots) {
      for (const firmwareId of slots.equipped) {
        const abilityDef = world.getComponent(firmwareId, AbilityDef);
        if (abilityDef && abilityDef.isActive && abilityDef.heatPerTurn > 0) {
          heat.current += abilityDef.heatPerTurn;
        }
      }
    }

    if (heat.current !== oldHeat) {
      eventBus.emit('HEAT_CHANGED', {
        entityId,
        oldHeat,
        newHeat: heat.current,
        maxSafe: heat.maxSafe,
      });
    }
  };

  const addHeat = (entityId: EntityId, amount: number) => {
    const heat = world.getComponent(entityId, Heat);
    if (!heat) return;

    const oldHeat = heat.current;
    heat.current += amount;

    eventBus.emit('HEAT_CHANGED', {
      entityId,
      oldHeat,
      newHeat: heat.current,
      maxSafe: heat.maxSafe,
    });
  };

  const vent = (entityId: EntityId) => {
    const heat = world.getComponent(entityId, Heat);
    if (!heat) return;

    const oldHeat = heat.current;
    heat.current = Math.floor(heat.current * (1 - heat.ventPercentage));
    heat.isVenting = true;

    eventBus.emit('VENT_COMPLETED', {
      entityId,
      oldHeat,
      newHeat: heat.current,
    });

    eventBus.emit('HEAT_CHANGED', {
      entityId,
      oldHeat,
      newHeat: heat.current,
      maxSafe: heat.maxSafe,
    });

    eventBus.emit('MESSAGE_EMITTED', {
      text: 'You vent excess Heat. Defense reduced until next turn.',
      type: 'info',
    });
  };

  const isInCorruptionZone = (entityId: EntityId): boolean => {
    const heat = world.getComponent(entityId, Heat);
    return heat ? heat.current > heat.maxSafe : false;
  };

  const getHeatPercentage = (entityId: EntityId): number => {
    const heat = world.getComponent(entityId, Heat);
    return heat ? (heat.current / heat.maxSafe) * 100 : 0;
  };

  const onTurnStart = () => {
    const players = world.query(Actor).filter(id => world.getComponent(id, Actor)?.isPlayer);
    for (const playerId of players) {
      dissipate(playerId);
    }
  };

  return {
    init() {
      eventBus.on('TURN_START', onTurnStart);
    },

    dispose() {
      eventBus.off('TURN_START', onTurnStart);
    },

    dissipate,
    addHeat,
    vent,
    isInCorruptionZone,
    getHeatPercentage,
  };
}

export type HeatSystem = ReturnType<typeof createHeatSystem>;
