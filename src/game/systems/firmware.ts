import { World } from '@engine/ecs/world';
import { Grid } from '@engine/grid/grid';
import { EventBus } from '@engine/events/event-bus';
import { EntityId } from '@engine/ecs/types';
import {
  AbilityDef,
  FirmwareSlots,
  Position,
  AbilityDefData,
  StatusEffects,
  Heat,
  FirmwareActivatedThisTurn
} from '@shared/components';
import { DamageIntent, TeleportIntent } from '@shared/components/intents';
import { GameplayEvents } from '@shared/events/types';
import { GameEvents } from '../events/types';
import { getLegacyHeatCost } from './legacy-code';

/**
 * Firmware system that handles activation of firmware abilities.
 */
export function createFirmwareSystem<T extends GameplayEvents>(
  world: World<T>,
  grid: Grid,
  eventBus: EventBus<T>
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

      // Check for FIRMWARE_LOCK
      const statusEffects = world.getComponent(entityId, StatusEffects);
      if (statusEffects?.effects.some(e => e.name === 'FIRMWARE_LOCK')) {
        eventBus.emit('MESSAGE_EMITTED', {
          text: 'ERROR: Firmware subsystem is locked! Try again later.',
          type: 'error'
        });
        return false;
      }

      console.log(`[FirmwareSystem] Activating ability in slot ${slotIndex} for entity ${entityId} at (${targetX}, ${targetY})`);
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

      if (abilityDef.effectType === 'dash' || abilityDef.effectType === 'dash_attack') {
        if (distance > abilityDef.dashDistance) return false;
        // Dash can target empty space or any tile (ignores collision)
      } else if (abilityDef.effectType === 'ranged_attack') {
        if (distance > abilityDef.range) return false;
      } else if (abilityDef.effectType === 'melee_attack') {
        if (distance > 1) return false; // Strict range 1 for melee
      }

      // 2. Heat cost
      const effectiveHeatCost = getLegacyHeatCost(abilityDef.heatCost, abilityDef.isLegacy);
      const heat = world.getComponent(entityId, Heat);
      if (heat) {
        const oldHeat = heat.current;
        const nextHeat = oldHeat + effectiveHeatCost;
        world.patchComponent(entityId, Heat, { current: nextHeat });
        eventBus.emit('HEAT_CHANGED', {
          entityId,
          oldHeat,
          newHeat: nextHeat,
          maxSafe: heat.maxSafe,
        });
      }

      // 3. Resolve effect
      if (abilityDef.effectType === 'dash' || abilityDef.effectType === 'dash_attack') {
        // Submit teleport intent instead of direct mutation
        world.addComponent(entityId, TeleportIntent, { x: targetX, y: targetY });

        eventBus.emit('MESSAGE_EMITTED', {
          text: `${abilityDef.name} activated! Dashed to (${targetX}, ${targetY}).`,
          type: 'info'
        });

        // For dash_attack, also check for targets at destination
        if (abilityDef.effectType === 'dash_attack') {
          const targets = grid.getEntitiesAt(targetX, targetY);
          for (const targetId of targets) {
            if (targetId === entityId) continue;

            // Per the Death Protocol, we delegate damage resolution to the CombatSystem
            world.addComponent(entityId, DamageIntent, {
              targetId: targetId as EntityId,
              amount: abilityDef.damageAmount || 5
            });
          }
        }
      } else if (abilityDef.effectType === 'ranged_attack' || abilityDef.effectType === 'melee_attack') {
        const targets = grid.getEntitiesAt(targetX, targetY);

        for (const targetId of targets) {
          if (targetId === entityId) continue;

          // Per the Death Protocol, we delegate damage resolution to the CombatSystem
          world.addComponent(entityId, DamageIntent, {
            targetId: targetId as EntityId,
            amount: abilityDef.damageAmount || 0
          });
        }

        eventBus.emit('MESSAGE_EMITTED', {
          text: `${abilityDef.name} activated! Targeted (${targetX}, ${targetY}).`,
          type: 'info'
        });

      } else if (abilityDef.effectType === 'toggle_vision') {
        const nextActive = !abilityDef.isActive;
        world.patchComponent(firmwareId, AbilityDef, { isActive: nextActive });

        eventBus.emit('FIRMWARE_TOGGLED', {
          entityId,
          firmwareEntityId: firmwareId,
          abilityName: abilityDef.name,
          active: nextActive
        });

        eventBus.emit('MESSAGE_EMITTED', {
          text: `${abilityDef.name} ${nextActive ? 'activated' : 'deactivated'}.`,
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

      world.addComponent(entityId, FirmwareActivatedThisTurn, { slotIndex });

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

export type FirmwareSystem<T extends GameplayEvents = GameEvents> = ReturnType<typeof createFirmwareSystem<T>>;
