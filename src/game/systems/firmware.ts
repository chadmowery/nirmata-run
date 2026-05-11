import { World } from '@engine/ecs/world';
import { Grid } from '@engine/grid/grid';
import { EventBus } from '@engine/events/event-bus';
import { EntityId, Phase } from '@engine/ecs/types';
import {
  AbilityDef,
  FirmwareSlots,
  Position,
  StatusEffects,
  FirmwareActivatedThisTurn
} from '@shared/components';
import { DamageIntent, TeleportIntent, FirmwareIntent, HeatIntent } from '@shared/components/intents';
import { GameplayEvents } from '@shared/events/types';
import { GameEvents } from '../events/types';
import { getLegacyHeatCost } from './legacy-code';
import { logger } from '@engine/utils/logger';

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
        logger.warn(`Activation blocked: Firmware locked for entity ${entityId}`, 'FIRMWARE');
        eventBus.emit('MESSAGE_EMITTED', {
          text: 'ERROR: Firmware subsystem is locked! Try again later.',
          type: 'error'
        });
        return false;
      }

      const firmwareId = slots.equipped[slotIndex];
      const abilityDef = world.getComponent(firmwareId, AbilityDef);
      if (!abilityDef) {
        logger.warn(`Failed to activate ability: No AbilityDef for firmware entity ${firmwareId}`, 'FIRMWARE');
        return false;
      }

      logger.info(`Activating ${abilityDef.name} (Slot: ${slotIndex}) for entity ${entityId} at (${targetX}, ${targetY})`, 'FIRMWARE');

      // 1. Validate target range/distance
      const pos = world.getComponent(entityId, Position);
      if (!pos) return false;

      const dx = Math.abs(targetX - pos.x);
      const dy = Math.abs(targetY - pos.y);
      const distance = dx + dy; // Manhattan distance

      if (abilityDef.effectType === 'dash' || abilityDef.effectType === 'dash_attack') {
        if (distance > abilityDef.dashDistance) {
          logger.warn(`Activation failed: Target (${targetX}, ${targetY}) out of dash range (${distance} > ${abilityDef.dashDistance})`, 'FIRMWARE');
          return false;
        }
        // Dash can target empty space or any tile (ignores collision)
      } else if (abilityDef.effectType === 'ranged_attack') {
        if (distance > abilityDef.range) {
          logger.warn(`Activation failed: Target (${targetX}, ${targetY}) out of ranged range (${distance} > ${abilityDef.range})`, 'FIRMWARE');
          return false;
        }
      } else if (abilityDef.effectType === 'melee_attack') {
        if (distance > 1) {
          logger.warn(`Activation failed: Target (${targetX}, ${targetY}) out of melee range (${distance} > 1)`, 'FIRMWARE');
          return false; // Strict range 1 for melee
        }
      }

      // 2. Heat cost
      const effectiveHeatCost = getLegacyHeatCost(abilityDef.heatCost, abilityDef.isLegacy);
      // 2. Submit HeatIntent instead of direct patching
      world.addComponent(entityId, HeatIntent, {
        targetId: entityId,
        amount: effectiveHeatCost
      });

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
     * Internal update loop that processes FirmwareIntents.
     */
    update(w: World<T>): void {
      const entities = w.query(FirmwareIntent);
      for (const entityId of entities) {
        const intent = w.getComponent(entityId, FirmwareIntent)!;
        this.activateAbility(
          entityId,
          intent.slotIndex,
          intent.targetX ?? 0,
          intent.targetY ?? 0
        );
        w.removeComponent(entityId, FirmwareIntent);
      }
    },

    _updateHandler: null as any,
    init() {
      this._updateHandler = (w: World<T>) => this.update(w);
      world.registerSystem(Phase.ACTION, this._updateHandler, 'FirmwareSystem');
    },
    dispose() {
      if (this._updateHandler) {
        world.unregisterSystem(Phase.ACTION, this._updateHandler);
      }
    }
  };
}

export type FirmwareSystem<T extends GameplayEvents = GameEvents> = ReturnType<typeof createFirmwareSystem<T>>;
