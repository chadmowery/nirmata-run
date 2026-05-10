import { World } from '@engine/ecs/world';
import { EntityId } from '@engine/ecs/types';
import { EventBus } from '@engine/events/event-bus';
import { BurnedSoftware, SoftwareDef, RarityTier, HealIntent, ApplyStatusEffectIntent } from '@shared/components';
import { GameplayEvents } from '@shared/events/types';

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
  const burned = world.getComponent(attackerId, BurnedSoftware);
  if (!burned?.weapon) return;

  const softwareDef = world.getComponent(burned.weapon, SoftwareDef);
  if (!softwareDef || softwareDef.type !== 'bleed') return;

  const rarity = world.getComponent(burned.weapon, RarityTier);
  if (!rarity) return;

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
    }
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
  const burned = world.getComponent(entityId, BurnedSoftware);
  if (!burned?.weapon) return false;

  const softwareDef = world.getComponent(burned.weapon, SoftwareDef);
  return softwareDef?.type === 'auto-loader';
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
  const burned = world.getComponent(killerId, BurnedSoftware);
  if (!burned?.armor) return;

  const softwareDef = world.getComponent(burned.armor, SoftwareDef);
  if (!softwareDef || softwareDef.type !== 'vampire') return;

  const rarity = world.getComponent(burned.armor, RarityTier);
  if (!rarity) return;

  const healAmount = Math.floor(softwareDef.baseMagnitude * rarity.scaleFactor);
  // baseMagnitude=5: v0.x→5, v1.x→7, v2.x→10, v3.x→15

  // Submit intent for heal resolution
  world.addComponent(killerId, HealIntent, {
    targetId: killerId,
    amount: healAmount
  });

  eventBus.emit('MESSAGE_EMITTED', {
    text: `Vampire.exe activated on kill.`,
    type: 'combat',
  });
}
