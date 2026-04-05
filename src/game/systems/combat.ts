import { World } from '@engine/ecs/world';
import { Grid } from '@engine/grid/grid';
import { EventBus } from '@engine/events/event-bus';
import { EntityFactory } from '@engine/entity/factory';
import { EntityId } from '@engine/ecs/types';
import { Attack, Defense, LootTable, Health, Position, Actor, Heat, BurnedSoftware, SoftwareDef, RarityTier } from '@shared/components';

import { GameplayEvents } from '@shared/events/types';

import { ComponentRegistry } from '@engine/entity/types';
import { EventOriginContext } from '@shared/utils/event-context';
import { applyBleedOnHit, applyVampireOnKill } from './software-effects';

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
      // (Bleed applies via status effect, not direct modifier)
      modifiers.push({
        source: `software:${softwareDef.type}`,
        type: 'additive',
        value: softwareDef.baseMagnitude * rarity.scaleFactor,
        phase: 'pre_defense',
      });
    }
  }

  return modifiers;
}

/**
 * Combat system that resolves damage and handles entity death.
 */
export function createCombatSystem<T extends GameplayEvents>(
  world: World<T>,
  grid: Grid,
  eventBus: EventBus<T>,
  entityFactory: EntityFactory,
  componentRegistry: ComponentRegistry,
  options: { skipLoot?: boolean } = {}
) {
  function resolveBumpAttack(payload: T['BUMP_ATTACK']) {
    if (EventOriginContext.current === 'server') return;
    const { attackerId, defenderId } = payload;

    const attackerAttack = world.getComponent(attackerId, Attack);
    const defenderHealth = world.getComponent(defenderId, Health);
    const defenderDefense = world.getComponent(defenderId, Defense);

    if (!attackerAttack || !defenderHealth) {
      return;
    }

    const modifiers = collectDamageModifiers(world, attackerId);
    const armor = defenderDefense?.armor ?? 0;
    const defenderHeat = world.getComponent(defenderId, Heat);
    const effectiveArmor = defenderHeat?.isVenting ? 0 : armor;

    const damage = resolveDamage(attackerAttack.power, modifiers, effectiveArmor);
    const oldHealth = defenderHealth.current;
    const newHealth = Math.max(0, oldHealth - damage);
    
    // Authoritative update: save back to world store (D-15)
    world.addComponent(defenderId, Health, { ...defenderHealth, current: newHealth });



    eventBus.emit('DAMAGE_DEALT', {
      attackerId,
      defenderId,
      amount: damage,
    });

    // Apply software effects like Bleed
    applyBleedOnHit(world, eventBus, attackerId, defenderId);

    // Emit UI message
    const attackerActor = world.getComponent(attackerId, Actor);
    const defenderActor = world.getComponent(defenderId, Actor);
    const attackerName = attackerActor?.isPlayer ? 'You' : 'The enemy';
    const defenderName = defenderActor?.isPlayer ? 'you' : 'the enemy';

    eventBus.emit('MESSAGE_EMITTED', {
      text: `${attackerName} hit ${defenderName} for ${damage} damage.`,
      type: 'combat'
    });

    if (newHealth <= 0) {
      handleDeath(defenderId, attackerId);
    }
  };

  const handleDeath = (entityId: EntityId, killerId: EntityId) => {
    const pos = world.getComponent(entityId, Position);
    const lootTable = world.getComponent(entityId, LootTable);

    // 1. Grid removal
    if (pos) {
      grid.removeEntity(entityId, pos.x, pos.y);
    }

    // 2. Roll loot table
    if (!options.skipLoot && lootTable && pos) {
      for (const drop of lootTable.drops) {
        if (Math.random() < drop.chance) {
          const itemId = entityFactory.create(
            world,
            drop.template,
            componentRegistry,
            {
              position: { x: pos.x, y: pos.y }
            }
          );
          grid.addItem(itemId, pos.x, pos.y);
        }
      }
    }

    const actor = world.getComponent(entityId, Actor);
    const isPlayer = !!actor?.isPlayer;

    // 3. Emit death event
    eventBus.emit('ENTITY_DIED', { entityId, killerId, isPlayer });

    // Apply software effects like Vampire (heal on kill)
    applyVampireOnKill(world, eventBus, killerId);

    const name = isPlayer ? 'You' : 'The enemy';
    eventBus.emit('MESSAGE_EMITTED', {
      text: `${name} died!`,
      type: 'combat'
    });

    // 4. Destroy entity
    world.destroyEntity(entityId);
  };

  return {
    init() {
      eventBus.on('BUMP_ATTACK', resolveBumpAttack);
    },

    dispose() {
      eventBus.off('BUMP_ATTACK', resolveBumpAttack);
    }
  };
}

export type CombatSystem = ReturnType<typeof createCombatSystem>;
