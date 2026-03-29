import { World } from '@engine/ecs/world';
import { EventBus } from '@engine/events/event-bus';
import { EntityId } from '@engine/ecs/types';
import { Heat, Shell } from '@shared/components';
import { GameplayEvents } from '@shared/events/types';
import { StatusEffectSystem } from './status-effects';

export interface KernelPanicResult {
  tier: number;
  effectName: string;
  rolled: boolean;
  effectApplied: boolean;
}

const KERNEL_PANIC_TABLE = [
  { minPercent: 101, maxPercent: 120, baseChance: 0.15, effectName: 'HUD_GLITCH', duration: 2, magnitude: 1, severity: 'minor' },
  { minPercent: 121, maxPercent: 140, baseChance: 0.30, effectName: 'INPUT_LAG', duration: 3, magnitude: 1, severity: 'moderate' },
  { minPercent: 141, maxPercent: 160, baseChance: 0.50, effectName: 'FIRMWARE_LOCK', duration: 2, magnitude: 1, severity: 'severe' },
  { minPercent: 161, maxPercent: Infinity, baseChance: 0.75, effectName: 'CRITICAL_REBOOT', duration: 3, magnitude: 1, severity: 'critical' },
] as const;

/**
 * System that manages Kernel Panic consequences when heat exceeds maxSafe levels.
 */
export function createKernelPanicSystem<T extends GameplayEvents>(
  world: World<T>,
  eventBus: EventBus<T>,
  statusEffectSystem: StatusEffectSystem,
) {
  const getTier = (heatPercent: number) => {
    return KERNEL_PANIC_TABLE.find(
      (tier) => heatPercent >= tier.minPercent && heatPercent <= tier.maxPercent,
    ) || null;
  };

  const checkOverclock = (entityId: EntityId): KernelPanicResult | null => {
    const heat = world.getComponent(entityId, Heat);
    const shell = world.getComponent(entityId, Shell);

    if (!heat || !shell) return null;

    const heatPercent = (heat.current / heat.maxSafe) * 100;
    if (heatPercent <= 100) return null;

    const tier = getTier(heatPercent);
    if (!tier) return null;

    const tierIndex = KERNEL_PANIC_TABLE.indexOf(tier) + 1;
    const effectiveChance = Math.max(0, tier.baseChance - shell.stability * 0.01);
    const rolled = true;
    const rollSucceeded = Math.random() < effectiveChance;

    if (rollSucceeded) {
      statusEffectSystem.applyEffect(entityId, {
        name: tier.effectName,
        duration: tier.duration,
        magnitude: tier.magnitude,
        source: 'kernel_panic',
      });

      if (tier.effectName === 'CRITICAL_REBOOT') {
        const oldHeat = heat.current;
        heat.current = 0;
        eventBus.emit('HEAT_CHANGED', {
          entityId,
          oldHeat,
          newHeat: heat.current,
          maxSafe: heat.maxSafe,
        });
      }

      eventBus.emit('KERNEL_PANIC_TRIGGERED', {
        entityId,
        tier: tierIndex,
        effectName: tier.effectName,
        severity: tier.severity,
      });

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

      return {
        tier: tierIndex,
        effectName: tier.effectName,
        rolled,
        effectApplied: true,
      };
    }

    return {
      tier: tierIndex,
      effectName: tier.effectName,
      rolled,
      effectApplied: false,
    };
  };

  const onFirmwareActivated = (payload: T['FIRMWARE_ACTIVATED']) => {
    checkOverclock(payload.entityId);
  };

  return {
    init() {
      eventBus.on('FIRMWARE_ACTIVATED', onFirmwareActivated);
    },

    dispose() {
      eventBus.off('FIRMWARE_ACTIVATED', onFirmwareActivated);
    },

    checkOverclock,
    getTier,
  };
}

export type KernelPanicSystem = ReturnType<typeof createKernelPanicSystem>;
