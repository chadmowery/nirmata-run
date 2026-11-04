import { World } from '@engine/ecs/world';
import { Grid } from '@engine/grid/grid';
import { EventBus } from '@engine/events/event-bus';
import { EntityId, Phase } from '@engine/ecs/types';
import { EntityFactory } from '@engine/entity/factory';
import { ComponentRegistry } from '@engine/entity/types';
import {
  Attack,
  Defense,
  Health,
  Actor,
  Heat,
  EquipmentSlots,
  Children,
  SoftwareDef,
  RarityTier,
  Dying,
  StatusEffects,
  AugmentSlots,
  AugmentData,
  DealtDamageThisTurn,
  AIState,
  AIBehaviorType,
  ApplyStatusEffectIntent,
  Position,
  InteractiveSurface,
  CorruptedNode,
  Shell,
  Hostile,
} from '@shared/components';
import { AttackIntent, DamageIntent, HealIntent } from '@shared/components/intents';
import { createTriggerContext, evaluateCondition } from './augment-util';
import { applyStatusEffect } from './status-effects';

import { GameplayEvents } from '@shared/events/types';
import { logger } from '@engine/utils/logger';

export interface DamageModifier {
  source: string; // e.g., 'software:bleed', 'augment:static-siphon'
  type: 'additive'; // Per D-12: Software modifiers are additive only
  value: number; // Flat bonus after rarity scaling
  phase: 'pre_defense'; // Per D-11: Software + Augment modifiers apply before defense
}

/**
 * Pure function to resolve final damage after modifiers and defense.
 * Per D-11: base attack -> Software modifiers (additive) -> Augment payloads -> defense -> final damage.
 */
export function resolveDamage(
  baseAttack: number,
  modifiers: DamageModifier[],
  defense: number,
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
  isVenting: boolean,
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
  attackerId: EntityId,
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
        if (
          softwareDef &&
          rarity &&
          softwareDef.effectType !== 'dot' &&
          softwareDef.effectType !== 'action_economy' &&
          softwareDef.effectType !== 'heal_on_kill'
        ) {
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
 * Checks if directional cover mitigates incoming ranged damage against defender.
 */
export function checkDirectionalCover<T extends GameplayEvents>(
  world: World<T>,
  attackerId: EntityId,
  defenderId: EntityId,
): { hasCover: boolean; reduction: number; coverId?: EntityId } {
  if (world.hasComponent(defenderId, InteractiveSurface)) {
    return { hasCover: false, reduction: 0 };
  }

  const attackerPos = world.getComponent(attackerId, Position);
  const defenderPos = world.getComponent(defenderId, Position);
  if (!attackerPos || !defenderPos) {
    return { hasCover: false, reduction: 0 };
  }

  const distToAttacker =
    Math.abs(attackerPos.x - defenderPos.x) + Math.abs(attackerPos.y - defenderPos.y);
  if (distToAttacker <= 1) {
    return { hasCover: false, reduction: 0 };
  }

  const surfaces = world.query(InteractiveSurface, Position);
  for (const surfaceId of surfaces) {
    if (surfaceId === defenderId || surfaceId === attackerId) continue;
    if (world.hasComponent(surfaceId, Dying)) continue;

    const surface = world.getComponent(surfaceId, InteractiveSurface);
    if (!surface || surface.providesCover === false) continue;

    const surfPos = world.getComponent(surfaceId, Position)!;
    const distToDefender =
      Math.abs(surfPos.x - defenderPos.x) + Math.abs(surfPos.y - defenderPos.y);
    if (distToDefender !== 1) continue;

    const distFromCoverToAttacker =
      Math.abs(surfPos.x - attackerPos.x) + Math.abs(surfPos.y - attackerPos.y);
    if (distFromCoverToAttacker < distToAttacker) {
      const defenderShell = world.getComponent(defenderId, Shell);
      const isBastion = defenderShell?.archetypeId?.toLowerCase().includes('bastion');
      const reduction = isBastion ? 0.35 : (surface.coverDamageReduction ?? 0.25);
      return { hasCover: true, reduction, coverId: surfaceId };
    }
  }

  return { hasCover: false, reduction: 0 };
}

/**
 * Handles destruction of props with InteractiveSurface, triggering hazard spills and cascade reactions
 * by attaching DamageIntent components to affected entities.
 */
export function handlePropDestruction<T extends GameplayEvents>(
  world: World<T>,
  grid: Grid,
  eventBus: EventBus<T>,
  destroyedId: EntityId,
  killerId: EntityId,
  visited: Set<EntityId> = new Set(),
): void {
  if (visited.has(destroyedId)) return;
  visited.add(destroyedId);

  const surface = world.getComponent(destroyedId, InteractiveSurface);
  const pos = world.getComponent(destroyedId, Position);
  if (!surface || !pos) return;

  // 1. Cryo-Vat hazard footprint (3x3)
  if (surface.hazardOnDestroy === 'cryo_spill') {
    eventBus.emit('MESSAGE_EMITTED', {
      text: '[CRYO SPILL]: Cryo-vat shattered into a cryogenic hazard!',
      type: 'combat',
    });

    const allPositions = world.query(Position);
    for (const eid of allPositions) {
      if (eid === destroyedId || visited.has(eid) || world.hasComponent(eid, Dying)) continue;
      const ePos = world.getComponent(eid, Position)!;
      if (Math.abs(ePos.x - pos.x) <= 1 && Math.abs(ePos.y - pos.y) <= 1) {
        const h = world.getComponent(eid, Health);
        if (h && h.isAlive !== false && h.current > 0) {
          world.addComponent(eid, DamageIntent, {
            attackerId: killerId,
            targetId: eid,
            amount: 4,
            damageType: 'environmental',
          });
        }
        applyStatusEffect(world, eventBus, eid, {
          name: 'MOVEMENT_SLOW',
          duration: 2,
          magnitude: 50,
          source: 'cryo_spill',
        });
      }
    }
  } else if (surface.hazardOnDestroy === 'emp_arc') {
    eventBus.emit('MESSAGE_EMITTED', {
      text: '[EMP ARC]: Capacitor bank discharged an electromagnetic shockwave!',
      type: 'combat',
    });

    const allPositions = world.query(Position);
    for (const eid of allPositions) {
      if (eid === destroyedId || visited.has(eid) || world.hasComponent(eid, Dying)) continue;
      const ePos = world.getComponent(eid, Position)!;
      const dist = Math.abs(ePos.x - pos.x) + Math.abs(ePos.y - pos.y);
      if (dist <= 2) {
        const h = world.getComponent(eid, Health);
        if (h && h.isAlive !== false && h.current > 0) {
          world.addComponent(eid, DamageIntent, {
            attackerId: killerId,
            targetId: eid,
            amount: 10,
            damageType: 'environmental',
          });
        }
        const actor = world.getComponent(eid, Actor);
        const hostile = world.getComponent(eid, Hostile);
        if (hostile || (actor && !actor.isPlayer)) {
          applyStatusEffect(world, eventBus, eid, {
            name: 'DISRUPT',
            duration: 2,
            magnitude: 1,
            source: 'emp_arc',
          });
        }
      }
    }
  } else if (surface.hazardOnDestroy === 'thermal_burst') {
    eventBus.emit('MESSAGE_EMITTED', {
      text: '[THERMAL BURST]: Superheated manifold ruptured into a fiery shockwave!',
      type: 'combat',
    });

    const allPositions = world.query(Position);
    for (const eid of allPositions) {
      if (eid === destroyedId || visited.has(eid) || world.hasComponent(eid, Dying)) continue;
      const ePos = world.getComponent(eid, Position)!;
      const dist = Math.abs(ePos.x - pos.x) + Math.abs(ePos.y - pos.y);
      if (dist <= 2) {
        const h = world.getComponent(eid, Health);
        if (h && h.isAlive !== false && h.current > 0) {
          world.addComponent(eid, DamageIntent, {
            attackerId: killerId,
            targetId: eid,
            amount: 8,
            damageType: 'environmental',
          });
        }
        const heat = world.getComponent(eid, Heat);
        if (heat) {
          const newHeat = Math.min(100, heat.current + 25);
          world.patchComponent(eid, Heat, { current: newHeat });
          eventBus.emit('HEAT_CHANGED', {
            entityId: eid,
            oldHeat: heat.current,
            newHeat,
            maxSafe: heat.maxSafe ?? 100,
          });
        }
      }
    }
  }

  // 2. Cascade Chain Reaction Rule (15 structural damage within Manhattan distance <= cascadeRadius)
  if (surface.hazardOnDestroy && surface.hazardOnDestroy !== 'none') {
    const cascadeCandidates = world.query(Position);
    for (const targetId of cascadeCandidates) {
      if (
        targetId === destroyedId ||
        visited.has(targetId) ||
        world.hasComponent(targetId, Dying)
      ) {
        continue;
      }
      const tPos = world.getComponent(targetId, Position)!;
      const dist = Math.abs(tPos.x - pos.x) + Math.abs(tPos.y - pos.y);
      if (dist <= (surface.cascadeRadius ?? 2)) {
        const targetSurface = world.getComponent(targetId, InteractiveSurface);
        const targetCorrupted = world.getComponent(targetId, CorruptedNode);

        if (targetSurface && targetSurface.destructible !== false) {
          const h = world.getComponent(targetId, Health);
          if (h && h.isAlive !== false && h.current > 0) {
            world.addComponent(targetId, DamageIntent, {
              attackerId: killerId,
              targetId,
              amount: 15,
              damageType: 'environmental',
            });
          }
        } else if (targetCorrupted && !targetCorrupted.isDisarmed) {
          const h = world.getComponent(targetId, Health);
          if (!h) {
            world.addComponent(targetId, Health, { current: 15, max: 15, isAlive: true });
          }
          world.addComponent(targetId, DamageIntent, {
            attackerId: killerId,
            targetId,
            amount: 15,
            damageType: 'environmental',
          });
        }
      }
    }
  }
}

/**
 * Combat system that resolves AttackIntent during the REACTION phase.
 */
export function createCombatSystem<T extends GameplayEvents>(
  world: World<T>,
  grid: Grid,
  eventBus: EventBus<T>,
  entityFactory?: EntityFactory,
  componentRegistry?: ComponentRegistry,
  options: { skipLoot?: boolean } = {},
) {
  void entityFactory;
  void componentRegistry;
  void options;
  const handleDeath = (
    entityId: EntityId,
    killerId: EntityId,
    visitedProps: Set<EntityId> = new Set(),
  ) => {
    const actor = world.getComponent(entityId, Actor);
    const isPlayer = !!actor?.isPlayer;

    // 1. Mark entity as dying
    // Per the Death Protocol, RewardDropSystem and GravediggerSystem will handle the rest in Phase.CLEANUP
    const surface = world.getComponent(entityId, InteractiveSurface);
    const reason = surface ? 'environmental_destruction' : 'damage';
    logger.info(`Entity ${entityId} CONDEMNED by killer ${killerId} (reason: ${reason})`, 'COMBAT');
    world.addComponent(entityId, Dying, { killerId, reason });

    const health = world.getComponent(entityId, Health);
    if (health) {
      world.patchComponent(entityId, Health, { isAlive: false, current: 0 });
    }

    eventBus.emit('ENTITY_DIED', {
      entityId,
      killerId,
      isPlayer,
    });

    if (surface) {
      handlePropDestruction(world, grid, eventBus, entityId, killerId, visitedProps);
    }
  };

  const update = (w: World<T>) => {
    const visitedProps = new Set<EntityId>();

    // 1. Process AttackIntents (Melee/Ranged weapon attacks)
    const attackEntities = w.query(AttackIntent);
    for (const attackerId of attackEntities) {
      const intent = w.getComponent(attackerId, AttackIntent)!;
      const defenderId = intent.targetId;

      const attackerAttack = w.getComponent(attackerId, Attack);
      const defenderHealth = w.getComponent(defenderId, Health);

      if (!attackerAttack || !defenderHealth || w.hasComponent(defenderId, Dying)) {
        w.removeComponent(attackerId, AttackIntent);
        continue;
      }

      const modifiers = collectDamageModifiers(w, attackerId);
      const defenderHeat = w.getComponent(defenderId, Heat);
      const effectiveArmor = getEffectiveArmor(w, defenderId, defenderHeat?.isVenting ?? false);

      let damage = resolveDamage(attackerAttack.power, modifiers, effectiveArmor);

      // Check Directional Cover
      const cover = checkDirectionalCover(w, attackerId, defenderId);
      if (cover.hasCover) {
        damage = Math.max(1, Math.floor(damage * (1 - cover.reduction)));
        const pct = Math.round(cover.reduction * 100);
        const defActor = w.getComponent(defenderId, Actor);
        const defName = defActor?.isPlayer ? 'You' : (defActor ? 'The enemy' : 'The obstacle');
        eventBus.emit('MESSAGE_EMITTED', {
          text: `[COVER]: ${defName} absorbed damage behind cover (${pct}% reduction).`,
          type: 'combat',
        });
      }

      const oldHealth = defenderHealth.current;
      const newHealth = Math.max(0, oldHealth - damage);

      logger.info(
        `Attack Resolved: ${attackerId} -> ${defenderId} | DMG: ${damage} (Health: ${oldHealth} -> ${newHealth})`,
        'COMBAT',
      );

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
          targets: [...dealtDamage.targets, defenderId],
        });
      } else {
        w.addComponent(attackerId, DealtDamageThisTurn, {
          amount: damage,
          targets: [defenderId],
        });
      }

      // Emit UI message
      const attackerActor = w.getComponent(attackerId, Actor);
      const defenderActor = w.getComponent(defenderId, Actor);
      const attackerName = attackerActor?.isPlayer ? 'You' : 'The enemy';
      const defenderName = defenderActor?.isPlayer ? 'you' : (defenderActor ? 'the enemy' : 'the obstacle');

      eventBus.emit('MESSAGE_EMITTED', {
        text: `${attackerName} hit ${defenderName} for ${damage} damage.`,
        type: 'combat',
      });

      // DESIGN-04: Null-Pointer attacks apply HUD_GLITCH (2 turns) on hit
      const attackerAI = w.getComponent(attackerId, AIState);
      if (attackerAI?.behaviorType === AIBehaviorType.NULL_POINTER && defenderActor?.isPlayer) {
        w.addComponent(attackerId, ApplyStatusEffectIntent, {
          targetId: defenderId,
          effect: {
            name: 'HUD_GLITCH',
            duration: 2,
            magnitude: 1,
            source: 'null_pointer',
          },
        });
      }

      if (newHealth <= 0) {
        handleDeath(defenderId, attackerId, visitedProps);
      }

      // Cleanup intent
      w.removeComponent(attackerId, AttackIntent);
    }

    // 2. Process DamageIntents in a bounded fixed-point loop (handles abilities and cascades)
    const MAX_CASCADE_DEPTH = 10;
    let iteration = 0;

    while (iteration < MAX_CASCADE_DEPTH) {
      iteration++;
      const damageEntities = w.query(DamageIntent);
      if (damageEntities.length === 0) break;

      for (const requesterId of damageEntities) {
        const intent = w.getComponent(requesterId, DamageIntent)!;
        const targetId = intent.targetId ?? requesterId;
        const attackerId = intent.attackerId ?? requesterId;
        const targetHealth = w.getComponent(targetId, Health);

        if (!targetHealth || w.hasComponent(targetId, Dying)) {
          w.removeComponent(requesterId, DamageIntent);
          continue;
        }

        const targetHeat = w.getComponent(targetId, Heat);
        const effectiveArmor = getEffectiveArmor(w, targetId, targetHeat?.isVenting ?? false);

        // Abilities and environmental use raw amount minus armor
        let finalDamage = Math.max(1, intent.amount - effectiveArmor);

        // Check Directional Cover (only if not environmental)
        if (intent.damageType !== 'environmental') {
          const cover = checkDirectionalCover(w, attackerId, targetId);
          if (cover.hasCover) {
            finalDamage = Math.max(1, Math.floor(finalDamage * (1 - cover.reduction)));
            const pct = Math.round(cover.reduction * 100);
            const defActor = w.getComponent(targetId, Actor);
            const defName = defActor?.isPlayer ? 'You' : (defActor ? 'The enemy' : 'The obstacle');
            eventBus.emit('MESSAGE_EMITTED', {
              text: `[COVER]: ${defName} absorbed damage behind cover (${pct}% reduction).`,
              type: 'combat',
            });
          }
        }

        const oldHealth = targetHealth.current;
        const newHealth = Math.max(0, oldHealth - finalDamage);

        logger.info(
          `Damage Intent Resolved: ${attackerId} -> ${targetId} | DMG: ${finalDamage} (Health: ${oldHealth} -> ${newHealth})`,
          'COMBAT',
        );

        w.patchComponent(targetId, Health, { current: newHealth });

        eventBus.emit('DAMAGE_DEALT', {
          attackerId,
          defenderId: targetId,
          amount: finalDamage,
        });

        if (newHealth <= 0) {
          handleDeath(targetId, attackerId, visitedProps);
        }

        w.removeComponent(requesterId, DamageIntent);
      }
    }

    // 3. Process HealIntents
    resolveHealIntents(w, eventBus);
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

/**
 * Attaches or stacks a HealIntent on an entity without overwriting existing heal amounts in the same turn.
 */
export function addHealIntent<T extends GameplayEvents>(
  world: World<T>,
  requesterId: EntityId,
  targetId: EntityId,
  amount: number,
): void {
  const existing = world.getComponent(requesterId, HealIntent);
  const totalAmount = (existing ? existing.amount : 0) + amount;
  world.addComponent(requesterId, HealIntent, {
    targetId,
    amount: totalAmount,
  });
}

/**
 * Pure intent-driven resolver for HealIntent components.
 */
export function resolveHealIntents<T extends GameplayEvents>(
  world: World<T>,
  eventBus: EventBus<T>,
): void {
  const healEntities = world.query(HealIntent);
  for (const requesterId of healEntities) {
    const intent = world.getComponent(requesterId, HealIntent)!;
    const targetId = intent.targetId;
    const targetHealth = world.getComponent(targetId, Health);

    if (targetHealth && targetHealth.isAlive && !world.hasComponent(targetId, Dying)) {
      const oldVal = targetHealth.current;
      const newVal = Math.min(targetHealth.max, oldVal + intent.amount);

      logger.info(
        `Heal Intent Resolved: ${targetId} | HP: ${oldVal} -> ${newVal} (+${intent.amount})`,
        'COMBAT',
      );

      world.patchComponent(targetId, Health, { current: newVal });

      eventBus.emit('HEALED', { entityId: targetId, amount: intent.amount });

      eventBus.emit('MESSAGE_EMITTED', {
        text: `Restored ${intent.amount} HP.`,
        type: 'info',
      });
    }

    world.removeComponent(requesterId, HealIntent);
  }
}

/**
 * Dedicated system running at the tail of Phase.PRE_TURN and Phase.REACTION to resolve
 * regeneration, on-kill, and reaction heal intents in the same turn.
 */
export function createHealSystem<T extends GameplayEvents>(
  world: World<T>,
  eventBus: EventBus<T>,
) {
  const updatePreTurn = (w: World<T>) => {
    resolveHealIntents(w, eventBus);
  };
  const updateReaction = (w: World<T>) => {
    resolveHealIntents(w, eventBus);
  };

  return {
    init() {
      world.registerSystem(Phase.PRE_TURN, updatePreTurn, 'HealSystem_PreTurn');
      world.registerSystem(Phase.REACTION, updateReaction, 'HealSystem_Reaction');
    },
    dispose() {
      world.unregisterSystem(Phase.PRE_TURN, updatePreTurn);
      world.unregisterSystem(Phase.REACTION, updateReaction);
    },
    update: updateReaction,
  };
}

export type CombatSystem<T extends GameplayEvents = GameplayEvents> = ReturnType<
  typeof createCombatSystem<T>
>;
