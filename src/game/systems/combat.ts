import { World } from '@engine/ecs/world';
import { Grid } from '@engine/grid/grid';
import { EventBus } from '@engine/events/event-bus';
import { EntityFactory } from '@engine/entity/factory';
import { EntityId, Phase } from '@engine/ecs/types';
import { Attack, Defense, Health, Actor, Heat, EquipmentSlots, Children, SoftwareDef, RarityTier, Dying, StatusEffects, AugmentSlots, AugmentData, DealtDamageThisTurn } from '@shared/components';
import { AttackIntent, DamageIntent, HealIntent } from '@shared/components/intents';
import { createTriggerContext, evaluateCondition } from './augment-util';

import { GameplayEvents } from '@shared/events/types';
import { logger } from '@engine/utils/logger';

import { ComponentRegistry } from '@engine/entity/types';

export interface DamageModifier {
  source: string;       // e.g., 'software:bleed', 'augment:static-siphon'
  type: 'additive';     // Per D-12: Software modifiers are additive only
  value: number;        // Flat bonus after rarity scaling
  phase: 'pre_defense'; // Per D-11: Software + Augment modifiers apply before defense
}

/**
 * Pure function to resolve final damage after modifiers and defense.
 * Per D-11: base attack -> Software modifiers (additive) -> Augment payloads -> defense -> final damage.
 */
export function resolveDamage(
  baseAttack: number,
  modifiers: DamageModifier[],
  defense: number
): number {
  let damage = baseAttack;

  // Apply all pre-defense modifiers (Software + Augments per D-11)
  for (const mod of modifiers) {
    if (mod.phase === 'pre_defense' && mod.type === 'additive') {
      damage += mod.value;
    }
  }

  // Apply defense
  const finalDamage = Math.max(1, damage - defense);

  return Math.floor(finalDamage);
}

/**
 * Gets effective armor by traversing EquipmentSlots hierarchy.
 */
export function getEffectiveArmor<T extends GameplayEvents>(
  world: World<T>,
  defenderId: EntityId,
  isVenting: boolean
): number {
  if (isVenting) return 0;
  const baseDefense = world.getComponent(defenderId, Defense);
  const equipment = world.getComponent(defenderId, EquipmentSlots);

  let armor = baseDefense?.armor ?? 0;
  if (equipment && equipment.armor !== null) {
    const armorEntityDef = world.getComponent(equipment.armor, Defense);
    armor += armorEntityDef?.armor ?? 0;
  }
  return armor;
}

/**
 * Collects active damage modifiers for an entity based on equipped weapon hierarchy.
 */
export function collectDamageModifiers<T extends GameplayEvents>(
  world: World<T>,
  attackerId: EntityId
): DamageModifier[] {
  const modifiers: DamageModifier[] = [];
  const equipment = world.getComponent(attackerId, EquipmentSlots);
  if (!equipment) return modifiers;

  // Collect weapon Software modifiers (traversing hierarchy)
  if (equipment.weapon !== null) {
    const weaponId = equipment.weapon;
    const children = world.getComponent(weaponId, Children);
    if (children) {
      for (const childId of children.entityIds) {
        const softwareDef = world.getComponent(childId, SoftwareDef);
        const rarity = world.getComponent(childId, RarityTier);
        if (softwareDef && rarity && softwareDef.effectType !== 'dot' && softwareDef.effectType !== 'action_economy' && softwareDef.effectType !== 'heal_on_kill') {
          modifiers.push({
            source: `software:${softwareDef.type}`,
            type: 'additive',
            value: softwareDef.baseMagnitude * rarity.scaleFactor,
            phase: 'pre_defense',
          });
        }
      }
    }
  }

  // 2. Collect Augment modifiers
  const augmentSlots = world.getComponent(attackerId, AugmentSlots);
  if (augmentSlots) {
    const ctx = createTriggerContext(world, attackerId);
    for (const augmentId of augmentSlots.equipped) {
      const augmentData = world.getComponent(augmentId, AugmentData);
      if (augmentData && evaluateCondition(augmentData.trigger, ctx)) {
        for (const payload of augmentData.payloads) {
          if (payload.type === 'DAMAGE_BONUS') {
            modifiers.push({
              source: `augment:${augmentData.name}`,
              type: 'additive',
              value: payload.magnitude ?? 0,
              phase: 'pre_defense',
            });
          }
        }
      }
    }
  }

  // 3. Collect Status Effect modifiers (e.g., DAMAGE_BOOST)
  const statusEffects = world.getComponent(attackerId, StatusEffects);
  if (statusEffects) {
    for (const effect of statusEffects.effects) {
      if (effect.name === 'DAMAGE_BOOST') {
        modifiers.push({
          source: 'status:damage_boost',
          type: 'additive',
          value: effect.magnitude ?? 0,
          phase: 'pre_defense',
        });
      }
    }
  }

  return modifiers;
}

/**
 * Combat system that resolves AttackIntent during the REACTION phase.
 */
export function createCombatSystem<T extends GameplayEvents>(
  world: World<T>,
  grid: Grid,
  eventBus: EventBus<T>,
  entityFactory: EntityFactory,
  componentRegistry: ComponentRegistry,
  options: { skipLoot?: boolean } = {}
) {
  const handleDeath = (entityId: EntityId, killerId: EntityId) => {
    const actor = world.getComponent(entityId, Actor);
    const isPlayer = !!actor?.isPlayer;

    // 1. Mark entity as dying
    // Per the Death Protocol, RewardDropSystem and GravediggerSystem will handle the rest in Phase.CLEANUP
    logger.info(`Entity ${entityId} CONDEMNED by killer ${killerId}`, 'COMBAT');
    world.addComponent(entityId, Dying, { killerId });

    eventBus.emit('ENTITY_DIED', {
      entityId,
      killerId,
      isPlayer,
    });
  };

  const update = (w: World<T>) => {
    // 1. Process AttackIntents (Melee/Ranged weapon attacks)
    const attackEntities = w.query(AttackIntent);
    for (const attackerId of attackEntities) {
      const intent = w.getComponent(attackerId, AttackIntent)!;
      const defenderId = intent.targetId;

      const attackerAttack = w.getComponent(attackerId, Attack);
      const defenderHealth = w.getComponent(defenderId, Health);
      const defenderDefense = w.getComponent(defenderId, Defense);

      if (!attackerAttack || !defenderHealth) {
        w.removeComponent(attackerId, AttackIntent);
        continue;
      }

      const modifiers = collectDamageModifiers(w, attackerId);
      const defenderHeat = w.getComponent(defenderId, Heat);
      const effectiveArmor = getEffectiveArmor(w, defenderId, defenderHeat?.isVenting ?? false);

      const damage = resolveDamage(attackerAttack.power, modifiers, effectiveArmor);
      const oldHealth = defenderHealth.current;
      const newHealth = Math.max(0, oldHealth - damage);

      logger.info(`Attack Resolved: ${attackerId} -> ${defenderId} | DMG: ${damage} (Health: ${oldHealth} -> ${newHealth})`, 'COMBAT');
      
      // Authoritative update
      w.patchComponent(defenderId, Health, { current: newHealth });

      eventBus.emit('DAMAGE_DEALT', {
        attackerId,
        defenderId,
        amount: damage,
      });

      // Track damage dealt this turn for augment/software triggers
      const dealtDamage = w.getComponent(attackerId, DealtDamageThisTurn);
      if (dealtDamage) {
        w.patchComponent(attackerId, DealtDamageThisTurn, {
          amount: dealtDamage.amount + damage,
          targets: [...dealtDamage.targets, defenderId]
        });
      } else {
        w.addComponent(attackerId, DealtDamageThisTurn, {
          amount: damage,
          targets: [defenderId]
        });
      }

      // Emit UI message
      const attackerActor = w.getComponent(attackerId, Actor);
      const defenderActor = w.getComponent(defenderId, Actor);
      const attackerName = attackerActor?.isPlayer ? 'You' : 'The enemy';
      const defenderName = defenderActor?.isPlayer ? 'you' : 'the enemy';

      eventBus.emit('MESSAGE_EMITTED', {
        text: `${attackerName} hit ${defenderName} for ${damage} damage.`,
        type: 'combat'
      });

      if (newHealth <= 0) {
        handleDeath(defenderId, attackerId);
      }

      // Cleanup intent
      w.removeComponent(attackerId, AttackIntent);
    }

    // 2. Process DamageIntents (Fixed damage from Firmware/Abilities)
    const damageEntities = w.query(DamageIntent);
    for (const requesterId of damageEntities) {
      const intent = w.getComponent(requesterId, DamageIntent)!;
      const targetId = intent.targetId;
      const targetHealth = w.getComponent(targetId, Health);
      const targetDefense = w.getComponent(targetId, Defense);

      if (!targetHealth) {
        w.removeComponent(requesterId, DamageIntent);
        continue;
      }

      const armor = targetDefense?.armor ?? 0;
      const targetHeat = w.getComponent(targetId, Heat);
      const effectiveArmor = getEffectiveArmor(w, targetId, targetHeat?.isVenting ?? false);

      // Abilities use raw amount minus armor
      const finalDamage = Math.max(1, intent.amount - effectiveArmor);
      const oldHealth = targetHealth.current;
      const newHealth = Math.max(0, oldHealth - finalDamage);

      logger.info(`Damage Intent Resolved: ${requesterId} -> ${targetId} | DMG: ${finalDamage} (Health: ${oldHealth} -> ${newHealth})`, 'COMBAT');

      w.patchComponent(targetId, Health, { current: newHealth });

      eventBus.emit('DAMAGE_DEALT', {
        attackerId: requesterId,
        defenderId: targetId,
        amount: finalDamage,
      });

      if (newHealth <= 0) {
        handleDeath(targetId, requesterId);
      }

      w.removeComponent(requesterId, DamageIntent);
    }

    // 3. Process HealIntents
    const healEntities = w.query(HealIntent);
    for (const requesterId of healEntities) {
      const intent = w.getComponent(requesterId, HealIntent)!;
      const targetId = intent.targetId;
      const targetHealth = w.getComponent(targetId, Health);

      if (targetHealth) {
        const oldVal = targetHealth.current;
        const newVal = Math.min(targetHealth.max, oldVal + intent.amount);
        
        logger.info(`Heal Intent Resolved: ${targetId} | HP: ${oldVal} -> ${newVal} (+${intent.amount})`, 'COMBAT');
        
        w.patchComponent(targetId, Health, { current: newVal });

        eventBus.emit('HEALED', { entityId: targetId, amount: intent.amount });

        eventBus.emit('MESSAGE_EMITTED', {
          text: `Restored ${intent.amount} HP.`,
          type: 'info'
        });
      }

      w.removeComponent(requesterId, HealIntent);
    }
  };

  return {
    init() {
      world.registerSystem(Phase.REACTION, update, 'CombatSystem');
    },
    dispose() {
      world.unregisterSystem(Phase.REACTION, update);
    },
    update,
  };
}

export type CombatSystem<T extends GameplayEvents = GameplayEvents> = ReturnType<typeof createCombatSystem<T>>;
