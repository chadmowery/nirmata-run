import { World } from '@engine/ecs/world';
import { EventBus } from '@engine/events/event-bus';
import { Phase } from '@engine/ecs/types';
import { logger } from '@engine/utils/logger';
import {
  DealtDamageThisTurn,
  Dying,
  SoftwareDef,
  EquipmentSlots,
  BurnSoftwareIntent,
  Children,
  EquipmentDef,
} from '@shared/components';
import { GameplayEvents } from '@shared/events/types';
import { applyBleedOnHit, applyVampireOnKill } from './software-effects';
import * as InventoryUtil from '@shared/utils/inventory-util';

/**
 * System that resolves Software effects (like Bleed and Vampire)
 * by observing transient components and entity states in Phase.REACTION.
 * This decouples software resolution from the core CombatSystem.
 */
export function createSoftwareSystem<T extends GameplayEvents>(
  world: World<T>,
  eventBus: EventBus<T>,
) {
  const update = (w: World<T>) => {
    // 1. Observe Damage Dealt (for Bleed)
    const attackers = w.query(DealtDamageThisTurn);
    for (const attackerId of attackers) {
      const dealtDamage = w.getComponent(attackerId, DealtDamageThisTurn)!;
      for (const defenderId of dealtDamage.targets) {
        applyBleedOnHit(w, eventBus, attackerId, defenderId);
      }
    }

    // 2. Observe Deaths (for Vampire)
    const dyingEntities = w.query(Dying);
    for (const dyingId of dyingEntities) {
      const dyingComp = w.getComponent(dyingId, Dying)!;
      if (dyingComp.killerId) {
        applyVampireOnKill(w, eventBus, dyingComp.killerId);
      }
    }
  };

  const updateIntents = (w: World<T>) => {
    const intents = w.query(BurnSoftwareIntent);
    for (const entityId of intents) {
      const intent = w.getComponent(entityId, BurnSoftwareIntent)!;
      const { softwareEntityId, targetSlot, inventoryIndex } = intent;

      const swDef = w.getComponent(softwareEntityId, SoftwareDef);
      if (!swDef) {
        eventBus.emit('MESSAGE_EMITTED', { text: 'Software definition not found.', type: 'error' });
        w.removeComponent(entityId, BurnSoftwareIntent);
        continue;
      }

      // 1. Slot check
      if (swDef.targetSlot !== targetSlot) {
        eventBus.emit('MESSAGE_EMITTED', {
          text: `Cannot burn ${swDef.name} onto ${targetSlot} slot. It requires ${swDef.targetSlot}.`,
          type: 'error',
        });
        w.removeComponent(entityId, BurnSoftwareIntent);
        continue;
      }

      // 2. Equipment check
      let burned = w.getComponent(entityId, EquipmentSlots);
      if (!burned) {
        const newData = { weapon: null, armor: null };
        w.addComponent(entityId, EquipmentSlots, newData);
        burned = newData;
      }

      const targetGearId = burned[targetSlot];
      const isPhysicalGear = targetGearId !== null && w.hasComponent(targetGearId, EquipmentDef);

      if (isPhysicalGear) {
        // Physical weapon/armor is equipped: attach software as child in gear's Children
        let children = w.getComponent(targetGearId, Children);
        if (!children) {
          const newChildren = { entityIds: [] };
          w.addComponent(targetGearId, Children, newChildren);
          children = newChildren;
        }

        // Duplicate check on gear
        let duplicate = false;
        for (const childId of children.entityIds) {
          const activeDef = w.getComponent(childId, SoftwareDef);
          if (activeDef && activeDef.type === swDef.type) {
            duplicate = true;
            break;
          }
        }
        if (duplicate) {
          eventBus.emit('MESSAGE_EMITTED', {
            text: `Software type ${swDef.type} is already active on ${targetSlot}.`,
            type: 'error',
          });
          w.removeComponent(entityId, BurnSoftwareIntent);
          continue;
        }

        // Overwrite existing burned software on this gear: mark old software child as dying
        for (const oldChildId of children.entityIds) {
          w.addComponent(oldChildId, Dying, { reason: 'overwritten' });
        }

        w.patchComponent(targetGearId, Children, {
          entityIds: [softwareEntityId],
        });
      } else {
        // Bare slot or legacy bare software
        const activeSoftwareIds = [burned.weapon, burned.armor].filter(
          (id): id is number => id !== null,
        );
        let duplicate = false;
        for (const activeId of activeSoftwareIds) {
          const activeDef = w.getComponent(activeId, SoftwareDef);
          if (activeDef && activeDef.type === swDef.type) {
            eventBus.emit('MESSAGE_EMITTED', {
              text: `Software type ${swDef.type} is already active.`,
              type: 'error',
            });
            duplicate = true;
            break;
          }
        }
        if (duplicate) {
          w.removeComponent(entityId, BurnSoftwareIntent);
          continue;
        }

        // Overwrite/Burn: Mark old software as dying
        const oldSoftwareId = burned[targetSlot];
        if (oldSoftwareId !== null) {
          w.addComponent(oldSoftwareId, Dying, { reason: 'overwritten' });
        }

        w.patchComponent(entityId, EquipmentSlots, {
          [targetSlot]: softwareEntityId,
        });
      }
      InventoryUtil.removeSoftware(w, entityId, inventoryIndex);

      eventBus.emit('MESSAGE_EMITTED', {
        text: `Successfully burned ${swDef.name} onto ${targetSlot}.`,
        type: 'combat',
      });

      logger.info(
        `Software Burn Success: ${swDef.name} onto ${targetSlot} for entity ${entityId}`,
        'SYSTEM',
      );

      w.removeComponent(entityId, BurnSoftwareIntent);
    }
  };

  return {
    init() {
      world.registerSystem(Phase.REACTION, update, 'SoftwareEffectSystem');
      world.registerSystem(Phase.ACTION, updateIntents, 'SoftwareIntentSystem');
    },
    dispose() {
      world.unregisterSystem(Phase.REACTION, update);
      world.unregisterSystem(Phase.ACTION, updateIntents);
    },
    update,
  };
}

export type SoftwareSystem<T extends GameplayEvents = GameplayEvents> = ReturnType<
  typeof createSoftwareSystem<T>
>;
