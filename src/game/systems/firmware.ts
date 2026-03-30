import { World } from '@engine/ecs/world';
import { Grid } from '@engine/grid/grid';
import { EventBus } from '@engine/events/event-bus';
import { EntityId } from '@engine/ecs/types';
import {
  AbilityDef,
  FirmwareSlots,
  Position,
  Health,
  Defense,
  Actor,
  AbilityDefData
} from '@shared/components';
import { GameplayEvents } from '@shared/events/types';
import { MovementSystem } from './movement';
import { HeatSystem } from './heat';

/**
 * Firmware system that handles activation of firmware abilities.
 * 
 * TODO(Phase 13): Firmware drops should require Flux compilation before equipping.
 * Currently, dropped firmware entities are immediately usable (stubbed Locked File mechanic).
 */
export function createFirmwareSystem<T extends GameplayEvents>(
  world: World<T>,
  grid: Grid,
  eventBus: EventBus<T>,
  _movementSystem: MovementSystem, // Kept for consistency with plan, though dash bypasses it
  heatSystem: HeatSystem
) {
  return {
    /**
     * Activates a firmware ability in a specific slot.
     */
    activateAbility(
      entityId: EntityId,
      slotIndex: number,
      targetX: number,
      targetY: number
    ): boolean {
      const slots = world.getComponent(entityId, FirmwareSlots);
      if (!slots || slotIndex < 0 || slotIndex >= slots.equipped.length) {
        return false;
      }

      const firmwareId = slots.equipped[slotIndex];
      const abilityDef = world.getComponent(firmwareId, AbilityDef);
      if (!abilityDef) {
        return false;
      }

      // 1. Validate target range/distance
      const pos = world.getComponent(entityId, Position);
      if (!pos) return false;

      const dx = Math.abs(targetX - pos.x);
      const dy = Math.abs(targetY - pos.y);
      const distance = dx + dy; // Manhattan distance

      if (abilityDef.effectType === 'dash') {
        if (distance > abilityDef.dashDistance) return false;
        // Dash can target empty space or any tile (ignores collision)
      } else if (abilityDef.effectType === 'ranged_attack') {
        if (distance > abilityDef.range) return false;
      }

      // 2. Heat cost
      let effectiveHeatCost = abilityDef.heatCost;
      if (abilityDef.isLegacy) {
        effectiveHeatCost *= 2;
      }
      heatSystem.addHeat(entityId, effectiveHeatCost);

      // 3. Resolve effect
      if (abilityDef.effectType === 'dash') {
        const oldX = pos.x;
        const oldY = pos.y;

        // Update position
        pos.x = targetX;
        pos.y = targetY;

        // Update grid
        grid.moveEntity(entityId, oldX, oldY, targetX, targetY);

        eventBus.emit('ENTITY_MOVED', {
          entityId,
          fromX: oldX,
          fromY: oldY,
          toX: targetX,
          toY: targetY,
        } as T['ENTITY_MOVED']);

        eventBus.emit('MESSAGE_EMITTED', {
          text: `${abilityDef.name} activated! Dashed to (${targetX}, ${targetY}).`,
          type: 'info'
        });

      } else if (abilityDef.effectType === 'ranged_attack') {
        const targets = grid.getEntitiesAt(targetX, targetY);

        for (const targetId of targets) {
          if (targetId === entityId) continue;

          const targetHealth = world.getComponent(targetId, Health);
          const targetDefense = world.getComponent(targetId, Defense);

          if (targetHealth) {
            const armor = targetDefense?.armor ?? 0;
            const damage = Math.max(1, abilityDef.damageAmount - armor);

            targetHealth.current = Math.max(0, targetHealth.current - damage);

            eventBus.emit('DAMAGE_DEALT', {
              attackerId: entityId,
              defenderId: targetId,
              amount: damage,
            } as T['DAMAGE_DEALT']);

            if (targetHealth.current <= 0) {
              // Handle death (similar to combat system)
              const targetPos = world.getComponent(targetId, Position);
              if (targetPos) {
                grid.removeEntity(targetId, targetPos.x, targetPos.y);
              }

              eventBus.emit('ENTITY_DIED', {
                entityId: targetId,
                killerId: entityId
              } as T['ENTITY_DIED']);

              const actor = world.getComponent(targetId, Actor);
              const name = actor?.isPlayer ? 'You' : 'The enemy';
              eventBus.emit('MESSAGE_EMITTED', {
                text: `${name} died!`,
                type: 'combat'
              });

              world.destroyEntity(targetId);
            }
          }
        }

        eventBus.emit('MESSAGE_EMITTED', {
          text: `${abilityDef.name} activated! Targeted (${targetX}, ${targetY}).`,
          type: 'info'
        });

      } else if (abilityDef.effectType === 'toggle_vision') {
        abilityDef.isActive = !abilityDef.isActive;

        eventBus.emit('FIRMWARE_TOGGLED', {
          entityId,
          firmwareEntityId: firmwareId,
          abilityName: abilityDef.name,
          active: abilityDef.isActive
        });

        eventBus.emit('MESSAGE_EMITTED', {
          text: `${abilityDef.name} ${abilityDef.isActive ? 'activated' : 'deactivated'}.`,
          type: 'info'
        });
      }

      eventBus.emit('FIRMWARE_ACTIVATED', {
        entityId,
        firmwareEntityId: firmwareId,
        slotIndex,
        abilityName: abilityDef.name,
        heatCost: effectiveHeatCost,
        targetX,
        targetY,
      });

      return true;
    },

    /**
     * Gets the ability definition for a firmware slot.
     */
    getAbilityDef(entityId: EntityId, slotIndex: number): AbilityDefData | null {
      const slots = world.getComponent(entityId, FirmwareSlots);
      if (!slots || slotIndex < 0 || slotIndex >= slots.equipped.length) {
        return null;
      }

      const firmwareId = slots.equipped[slotIndex];
      const abilityDef = world.getComponent(firmwareId, AbilityDef);
      return abilityDef || null;
    },

    init() { },
    dispose() { }
  };
}

export type FirmwareSystem = ReturnType<typeof createFirmwareSystem>;
