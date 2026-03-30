import { World } from '@engine/ecs/world';
import { EntityId } from '@engine/ecs/types';
import { EventBus } from '@engine/events/event-bus';
import { BurnedSoftware, SoftwareDef, RarityTier, StatusEffects, Health } from '@shared/components';
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

  const statusEffects = world.getComponent(defenderId, StatusEffects);
  if (!statusEffects) return;

  statusEffects.effects.push({
    name: 'BLEED',
    duration: 3,
    magnitude: scaledDamage,
    source: `software:bleed-${rarity.tier}`,
  });

  eventBus.emit('STATUS_EFFECT_APPLIED', {
    entityId: defenderId,
    effectName: 'BLEED',
    duration: 3,
    magnitude: scaledDamage,
    source: `software:bleed-${rarity.tier}`,
  });

  eventBus.emit('SOFTWARE_MODIFIER_APPLIED', {
    entityId: attackerId,
    softwareType: 'bleed',
    magnitude: scaledDamage,
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

  const health = world.getComponent(killerId, Health);
  if (!health) return;

  const oldHealth = health.current;
  health.current = Math.min(health.max, health.current + healAmount);
  const actualHeal = health.current - oldHealth;

  if (actualHeal > 0) {
    eventBus.emit('HEALED', { entityId: killerId, amount: actualHeal });
    eventBus.emit('SOFTWARE_MODIFIER_APPLIED', {
      entityId: killerId,
      softwareType: 'vampire',
      magnitude: actualHeal,
    });
    eventBus.emit('MESSAGE_EMITTED', {
      text: `Vampire.exe: Healed ${actualHeal} HP on kill.`,
      type: 'combat',
    });
  }
}
