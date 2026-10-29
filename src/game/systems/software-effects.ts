import { World } from '@engine/ecs/world';
import { EntityId } from '@engine/ecs/types';
import { EventBus } from '@engine/events/event-bus';
import {
  EquipmentSlots,
  SoftwareDef,
  RarityTier,
  HealIntent,
  ApplyStatusEffectIntent,
  Children,
  SoftwareSlots,
} from '@shared/components';
import { GameplayEvents } from '@shared/events/types';

/**
 * Finds active software of a specific type either attached to equipped gear as a child entity,
 * directly on the gear slot, or in the player's software slots.
 */
function findSoftwareEntity<T extends GameplayEvents>(
  world: World<T>,
  entityId: EntityId,
  slot: 'weapon' | 'armor',
  softwareType: string,
): EntityId | null {
  const eq = world.getComponent(entityId, EquipmentSlots);
  const gearId = eq ? eq[slot] : null;

  if (gearId !== null && gearId !== undefined) {
    // 1. Check gear Children
    const children = world.getComponent(gearId, Children);
    if (children) {
      for (const childId of children.entityIds) {
        const swDef = world.getComponent(childId, SoftwareDef);
        if (swDef && swDef.type === softwareType) {
          return childId;
        }
      }
    }
    // 2. Direct SoftwareDef on gear (backward compatibility)
    const directDef = world.getComponent(gearId, SoftwareDef);
    if (directDef && directDef.type === softwareType) {
      return gearId;
    }
  }

  // 3. Fallback to player SoftwareSlots
  const sSlots = world.getComponent(entityId, SoftwareSlots);
  if (sSlots) {
    for (const childId of sSlots.equipped) {
      const swDef = world.getComponent(childId, SoftwareDef);
      if (swDef && swDef.type === softwareType) {
        return childId;
      }
    }
  }

  return null;
}

/**
 * Bleed.exe: Apply BLEED DoT status effect on physical attack hit.
 * Per D-16: DoT ticks at target's turn start (StatusEffects system handles tick timing).
 * baseMagnitude=2 damage per tick, duration=3 turns. Scaled by rarity per D-07.
 */
export function applyBleedOnHit<T extends GameplayEvents>(
  world: World<T>,
  eventBus: EventBus<T>,
  attackerId: EntityId,
  defenderId: EntityId,
): void {
  const softwareEntityId = findSoftwareEntity(world, attackerId, 'weapon', 'bleed');
  if (softwareEntityId === null) return;

  const softwareDef = world.getComponent(softwareEntityId, SoftwareDef);
  if (!softwareDef) return;

  const rarity = world.getComponent(softwareEntityId, RarityTier) ?? { tier: 'v1.x', scaleFactor: 1.5 };
  const scaledDamage = softwareDef.baseMagnitude * rarity.scaleFactor;
  // baseMagnitude=2: v0.x→2, v1.x→3, v2.x→4, v3.x→6

  // Submit intent for status effect resolution
  world.addComponent(attackerId, ApplyStatusEffectIntent, {
    targetId: defenderId,
    effect: {
      name: 'BLEED',
      duration: 3,
      magnitude: scaledDamage,
      source: `software:bleed-${rarity.tier}`,
    },
  });
}

/**
 * Auto-Loader.msi: Check if player has Auto-Loader burned on weapon.
 * Per D-14: Allows move AND Firmware use in same turn.
 * Does NOT apply to Vent action (Vent is not Firmware).
 * Returns true if Auto-Loader is active on the entity.
 */
export function checkAutoLoader<T extends GameplayEvents>(
  world: World<T>,
  entityId: EntityId,
): boolean {
  return findSoftwareEntity(world, entityId, 'weapon', 'auto-loader') !== null;
}

/**
 * Vampire.exe: Heal player on any kill.
 * Per D-15: Triggers from bump attacks AND Firmware kills.
 * baseHeal=5 HP, scaled by rarity per D-07.
 * v0.x→5, v1.x→7.5→7, v2.x→10, v3.x→15
 */
export function applyVampireOnKill<T extends GameplayEvents>(
  world: World<T>,
  eventBus: EventBus<T>,
  killerId: EntityId,
): void {
  const softwareEntityId = findSoftwareEntity(world, killerId, 'armor', 'vampire');
  if (softwareEntityId === null) return;

  const softwareDef = world.getComponent(softwareEntityId, SoftwareDef);
  if (!softwareDef) return;

  const rarity = world.getComponent(softwareEntityId, RarityTier) ?? { tier: 'v1.x', scaleFactor: 1.5 };
  const healAmount = Math.floor(softwareDef.baseMagnitude * rarity.scaleFactor);
  // baseMagnitude=5: v0.x→5, v1.x→7, v2.x→10, v3.x→15

  // Submit intent for heal resolution
  world.addComponent(killerId, HealIntent, {
    targetId: killerId,
    amount: healAmount,
  });

  eventBus.emit('MESSAGE_EMITTED', {
    text: `Vampire.exe activated on kill.`,
    type: 'combat',
  });
}
