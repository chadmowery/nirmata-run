import { World } from '@engine/ecs/world';
import { Grid } from '@engine/grid/grid';
import { EventBus } from '@engine/events/event-bus';
import { EntityFactory } from '@engine/entity/factory';
import { EntityId, Phase } from '@engine/ecs/types';
import { Attack, Defense, Health, Actor, Heat, BurnedSoftware, SoftwareDef, RarityTier, Dying, StatusEffects, AugmentSlots, AugmentData, DealtDamageThisTurn } from '@shared/components';
import { AttackIntent, DamageIntent } from '@shared/components/intents';
import { createTriggerContext, evaluateCondition } from './augment-util';

import { GameplayEvents } from '@shared/events/types';

import { ComponentRegistry } from '@engine/entity/types';
import { applyBleedOnHit } from './software-effects';

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
 * Collects active damage modifiers for an entity based on burned software.
 */
export function collectDamageModifiers<T extends GameplayEvents>(
  world: World<T>,
  attackerId: EntityId
): DamageModifier[] {
  const modifiers: DamageModifier[] = [];
  const burnedSoftware = world.getComponent(attackerId, BurnedSoftware);
  if (!burnedSoftware) return modifiers;

  // Collect weapon Software modifier (offensive Software on weapon)
  if (burnedSoftware.weapon !== null) {
    const softwareDef = world.getComponent(burnedSoftware.weapon, SoftwareDef);
    const rarity = world.getComponent(burnedSoftware.weapon, RarityTier);
    if (softwareDef && rarity && softwareDef.effectType !== 'dot' && softwareDef.effectType !== 'action_economy' && softwareDef.effectType !== 'heal_on_kill') {
      // Non-DoT weapon Software adds flat damage bonus
      modifiers.push({
        source: `software:${softwareDef.type}`,
        type: 'additive',
        value: softwareDef.baseMagnitude * rarity.scaleFactor,
        phase: 'pre_defense',
      });
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

    // 1. Emit death event for external observers (UI, SFX)
    eventBus.emit('ENTITY_DIED', { entityId, killerId, isPlayer });

    const name = isPlayer ? 'You' : 'The enemy';
    eventBus.emit('MESSAGE_EMITTED', {
      text: `${name} died!`,
      type: 'combat'
    });

    // 2. Mark entity as dying
    // Per the Death Protocol, RewardDropSystem and GravediggerSystem will handle the rest in Phase.CLEANUP
    world.addComponent(entityId, Dying, { killerId });
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
      const armor = defenderDefense?.armor ?? 0;
      const defenderHeat = w.getComponent(defenderId, Heat);
      const effectiveArmor = defenderHeat?.isVenting ? 0 : armor;

      const damage = resolveDamage(attackerAttack.power, modifiers, effectiveArmor);
      const oldHealth = defenderHealth.current;
      const newHealth = Math.max(0, oldHealth - damage);

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
      const effectiveArmor = targetHeat?.isVenting ? 0 : armor;

      // Abilities use raw amount minus armor
      const finalDamage = Math.max(1, intent.amount - effectiveArmor);
      const oldHealth = targetHealth.current;
      const newHealth = Math.max(0, oldHealth - finalDamage);

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
  };

  return {
    init() {
      world.registerSystem(Phase.REACTION, update);
    },
    dispose() {
      world.unregisterSystem(Phase.REACTION, update);
    },
    update,
  };
}

export type CombatSystem<T extends GameplayEvents = GameplayEvents> = ReturnType<typeof createCombatSystem<T>>;
