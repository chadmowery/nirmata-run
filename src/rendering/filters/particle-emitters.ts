import { Sprite, Container } from 'pixi.js';
import { AIBehaviorType } from '@shared/components/ai-state';
import { ParticleSystem, getBehaviorColorHex } from '../particles';

let sharedParticleSystem: ParticleSystem | null = null;

function getSharedSystem(): ParticleSystem {
  if (!sharedParticleSystem) {
    sharedParticleSystem = new ParticleSystem();
  }
  return sharedParticleSystem;
}

/**
 * Returns read-only particle emitter telemetry.
 */
export function getParticleTelemetry(): { activeEmitters: number; totalParticles: number } {
  const telemetry = getSharedSystem().getTelemetry();
  return {
    activeEmitters: telemetry.activeEmitters,
    totalParticles: telemetry.totalParticles,
  };
}

/**
 * Attaches a pooled dual-mode lit neon emitter to an enemy sprite.
 */
export function attachNeonEmitter(
  sprite: Sprite,
  behaviorType: AIBehaviorType,
  effectsLayer: Container,
): void {
  getSharedSystem().attachBehaviorEmitter(sprite, behaviorType, effectsLayer);
}

/**
 * Updates all active emitters via the pooled ParticleSystem.
 */
export function updateAllEmitters(deltaMs: number): void {
  getSharedSystem().update(deltaMs);
}

/**
 * Legacy helper maintained for API compatibility; updates the shared pool.
 */
export function updateEmitter(_sprite: Sprite, deltaMs: number): void {
  getSharedSystem().update(deltaMs);
}

/**
 * Cleans up the emitter for a specific sprite.
 */
export function cleanupEmitter(sprite: Sprite): void {
  getSharedSystem().cleanupEmitter(sprite);
}

/**
 * Disposes all active emitters.
 */
export function disposeAllEmitters(): void {
  if (sharedParticleSystem) {
    sharedParticleSystem.destroy();
    sharedParticleSystem = null;
  }
}

/**
 * For testing purposes: expose color mapping.
 */
export function _getColorForBehavior(behaviorType: AIBehaviorType): number {
  return getBehaviorColorHex(behaviorType);
}
