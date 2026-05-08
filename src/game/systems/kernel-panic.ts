import { World } from '@engine/ecs/world';
import { EventBus } from '@engine/events/event-bus';
import { EntityId } from '@engine/ecs/types';
import { Heat, Shell } from '@shared/components';
import { GameplayEvents } from '@shared/events/types';

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
      const allStores = world.getSerializableState().stores;
      const entityComponents = Object.keys(allStores).filter(k => allStores[k][entityId] !== undefined);
      console.warn(`[KernelPanic] MISSING COMPONENTS for entity ${entityId}. Has: [${entityComponents.join(', ')}]. Heat: ${!!heat}, Shell: ${!!shell}`);
      return null;
    }

    const heatPercent = (heat.current / heat.maxSafe) * 100;
    console.log(`[KernelPanic] >> EVALUATING OVERCLOCK for entity ${entityId} <<`);
    console.log(`[KernelPanic] Heat: ${heat.current}/${heat.maxSafe} (${heatPercent.toFixed(1)}%)`);

    if (heatPercent <= 100) return null;

    // Filter all tiers that are eligible at this heat level
    const eligibleTiers = KERNEL_PANIC_TABLE.filter(
      (tier) => heatPercent >= tier.minPercent
    );

    const tierNames = eligibleTiers.map(t => t.effectName).join(', ');
    console.log(`[KernelPanic] Eligible tiers: [${tierNames}]`);

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

      console.log(`[KernelPanic] Rolling for Tier: ${tier.effectName} (Base ${tier.baseChance}, Stability ${-stabilityBonus.toFixed(2)} -> Eff ${effChance.toFixed(2)}). Roll: ${roll.toFixed(2)}`);

      if (roll < effChance) {
        console.log(`[KernelPanic] >> SUCCESS: Applying ${tier.effectName}`);
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
          console.log(`[KernelPanic] >> CRITICAL_REBOOT: Venting heat to 0`);
          const oldHeat = heat.current;
          world.patchComponent(entityId, Heat, { current: 0 });
          eventBus.emit('HEAT_CHANGED', {
            entityId,
            oldHeat,
            newHeat: 0,
            maxSafe: heat.maxSafe,
          });
        }

        // Only one panic consequence per heat spike (the most severe that succeeds)
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
      } else {
        console.log(`[KernelPanic] >> FAILED roll for ${tier.effectName}`);
      }
    }

    if (triggeredTier > 0) {
      console.log(`[KernelPanic] Panic triggered: ${appliedEffectName}`);
      return {
        tier: triggeredTier,
        effectName: appliedEffectName,
        rolled: true,
        effectApplied: true,
      };
    }

    console.log(`[KernelPanic] No panics triggered after rolling all eligible tiers.`);

    return {
      tier: 0,
      effectName: '',
      rolled: true,
      effectApplied: false,
    };
  };

  const onHeatChanged = (payload: T['HEAT_CHANGED']) => {
    console.log(`[KernelPanic] EVENT_RECEIVED: HEAT_CHANGED for entity ${payload.entityId} (Old: ${payload.oldHeat}, New: ${payload.newHeat})`);
    if (payload.newHeat > payload.oldHeat) {
      checkOverclock(payload.entityId);
    }
  };

  return {
    init() {
      console.log('[KernelPanicSystem] Initializing and registering listeners...');
      eventBus.on('HEAT_CHANGED', onHeatChanged);
    },

    dispose() {
      eventBus.off('HEAT_CHANGED', onHeatChanged);
    },

    checkOverclock,
    getTier,
  };
}

export type KernelPanicSystem = ReturnType<typeof createKernelPanicSystem>;
