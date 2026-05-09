import { World } from '@engine/ecs/world';
import { EventBus } from '@engine/events/event-bus';
import { EntityId, Phase } from '@engine/ecs/types';
import { Heat, Shell } from '@shared/components';
import { GameplayEvents } from '@shared/events/types';
import { GameEvents } from '../events/types';

export interface KernelPanicResult {
  tier: number;
  effectName: string;
  rolled: boolean;
  effectApplied: boolean;
}

const KERNEL_PANIC_TABLE = [
  { tier: 1, minPercent: 100, maxPercent: 120, baseChance: 0.15, effectName: 'HUD_GLITCH', duration: 2, magnitude: 1, severity: 'minor' },
  { tier: 2, minPercent: 121, maxPercent: 140, baseChance: 0.25, effectName: 'INPUT_LAG', duration: 3, magnitude: 1, severity: 'moderate' },
  { tier: 3, minPercent: 141, maxPercent: 160, baseChance: 0.50, effectName: 'FIRMWARE_LOCK', duration: 2, magnitude: 1, severity: 'severe' },
  { tier: 4, minPercent: 161, maxPercent: Infinity, baseChance: 1.0, effectName: 'CRITICAL_REBOOT', duration: 3, magnitude: 1, severity: 'critical' },
] as const;

/**
 * System that manages Kernel Panic consequences when heat exceeds maxSafe levels.
 */
export function createKernelPanicSystem<T extends GameplayEvents>(
  world: World<T>,
  eventBus: EventBus<T>,
) {
  const getTier = (heatPercent: number) => {
    return KERNEL_PANIC_TABLE.find(
      (tier) => heatPercent >= tier.minPercent && heatPercent <= tier.maxPercent,
    ) || null;
  };

  const checkOverclock = (entityId: EntityId): KernelPanicResult | null => {
    const heat = world.getComponent(entityId, Heat);
    const shell = world.getComponent(entityId, Shell);

    if (!heat || !shell) {
      return null;
    }

    const heatPercent = (heat.current / heat.maxSafe) * 100;
    
    if (heatPercent <= 100) return null;

    // Filter all tiers that are eligible at this heat level
    const eligibleTiers = KERNEL_PANIC_TABLE.filter(
      (tier) => heatPercent >= tier.minPercent
    );

    if (eligibleTiers.length === 0) return null;

    let triggeredTier = 0;
    let appliedEffectName = '';

    // Evaluate tiers from most severe to least severe (highest minPercent to lowest)
    const sortedTiers = [...eligibleTiers].sort((a, b) => b.minPercent - a.minPercent);
    const stabilityBonus = shell.stability * 0.01;

    for (const tier of sortedTiers) {
      // Roll for this tier
      const roll = Math.random();
      const effChance = Math.max(0, tier.baseChance - stabilityBonus);

      if (roll < effChance) {
        appliedEffectName = tier.effectName;

        eventBus.emit('APPLY_STATUS_EFFECT', {
          entityId,
          effect: {
            name: tier.effectName,
            duration: tier.duration,
            magnitude: tier.magnitude,
            severity: tier.severity,
            source: 'kernel_panic'
          }
        });

        eventBus.emit('KERNEL_PANIC_TRIGGERED', {
          entityId,
          tier: tier.tier,
          effectName: tier.effectName,
          severity: tier.severity,
        } as unknown as T['KERNEL_PANIC_TRIGGERED']);

        triggeredTier = tier.tier;

        if (tier.effectName === 'CRITICAL_REBOOT') {
          const oldHeat = heat.current;
          world.patchComponent(entityId, Heat, { current: 0 });
          eventBus.emit('HEAT_CHANGED', {
            entityId,
            oldHeat,
            newHeat: 0,
            maxSafe: heat.maxSafe,
          });
        }

        let message = '';
        switch (tier.severity) {
          case 'minor':
            message = `⚠ KERNEL_PANIC_DETECTED: ${tier.effectName} — Display artifacts for ${tier.duration} turns`;
            break;
          case 'moderate':
            message = `⚠ KERNEL_PANIC_DETECTED: ${tier.effectName} — Controls sluggish for ${tier.duration} turns`;
            break;
          case 'severe':
            message = `⚠⚠ KERNEL_PANIC_CRITICAL: ${tier.effectName} — Firmware offline for ${tier.duration} turns`;
            break;
          case 'critical':
            message = `⚠⚠⚠ CRITICAL_REBOOT — System rebooting. Stunned for ${tier.duration} turns. Heat vented to 0.`;
            break;
        }

        eventBus.emit('MESSAGE_EMITTED', {
          text: message,
          type: 'info',
        });

        break;
      }
    }

    if (triggeredTier > 0) {
      return {
        tier: triggeredTier,
        effectName: appliedEffectName,
        rolled: true,
        effectApplied: true,
      };
    }

    return {
      tier: 0,
      effectName: '',
      rolled: true,
      effectApplied: false,
    };
  };

  const updateCleanup = (w: World<T>) => {
    const entities = w.query(Heat, Shell);
    for (const entityId of entities) {
      checkOverclock(entityId);
    }
  };

  return {
    init() {
      world.registerSystem(Phase.CLEANUP, updateCleanup);
    },

    dispose() {
      world.unregisterSystem(Phase.CLEANUP, updateCleanup);
    },

    checkOverclock,
    getTier,
  };
}

export type KernelPanicSystem<T extends GameplayEvents = GameEvents> = ReturnType<typeof createKernelPanicSystem<T>>;
