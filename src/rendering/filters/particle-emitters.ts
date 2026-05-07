import { Sprite, Container, Graphics } from 'pixi.js';
import { AIBehaviorType } from '@shared/components/ai-state';

interface Particle {
  graphics: Graphics;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
}

interface EmitterState {
  container: Container;
  particles: Particle[];
  color: number;
  maxParticles: number;
  spawnTimer: number;
  spawnRate: number; // ms between spawns
}

const emitters = new WeakMap<Sprite, EmitterState>();
const activeSprites = new Set<Sprite>();

/**
 * Maps AIBehaviorType to its corresponding neon particle color.
 */
function getColorForBehavior(behaviorType: AIBehaviorType): number {
  switch (behaviorType) {
    case AIBehaviorType.NULL_POINTER:
    case AIBehaviorType.BUFFER_OVERFLOW:
      return 0x00F0FF; // Cyan
    case AIBehaviorType.FRAGMENTER:
    case AIBehaviorType.LOGIC_LEAKER:
      return 0xFF0055; // Pink
    case AIBehaviorType.SYSTEM_ADMIN:
    case AIBehaviorType.SEED_EATER:
      return 0xFFFFFF; // White
    default:
      return 0x00F0FF; // Cyan (T1)
  }
}

/**
 * Attaches a neon particle emitter to an enemy sprite.
 */
export function attachNeonEmitter(sprite: Sprite, behaviorType: AIBehaviorType, effectsLayer: Container): void {
  if (emitters.has(sprite)) return;

  const container = new Container();
  effectsLayer.addChild(container);

  const state: EmitterState = {
    container,
    particles: [],
    color: getColorForBehavior(behaviorType),
    maxParticles: 15,
    spawnTimer: 0,
    spawnRate: 100,
  };

  emitters.set(sprite, state);
  activeSprites.add(sprite);
}

/**
 * Updates all active emitters. Moves particles, spawns new ones, and handles cleanup.
 */
export function updateAllEmitters(deltaMs: number): void {
  for (const sprite of activeSprites) {
    if (sprite.destroyed) {
      cleanupEmitter(sprite);
      continue;
    }
    updateEmitter(sprite, deltaMs);
  }
}

/**
 * Updates a single emitter attached to a sprite.
 */
export function updateEmitter(sprite: Sprite, deltaMs: number): void {
  const state = emitters.get(sprite);
  if (!state || !sprite.visible || sprite.alpha === 0) {
    if (state) state.container.visible = false;
    return;
  }

  state.container.visible = true;
  state.container.x = sprite.x;
  state.container.y = sprite.y;

  // 1. Update existing particles
  for (let i = state.particles.length - 1; i >= 0; i--) {
    const p = state.particles[i];
    p.life += deltaMs;
    
    if (p.life >= p.maxLife) {
      p.graphics.destroy();
      state.particles.splice(i, 1);
      continue;
    }

    p.graphics.x += p.vx * deltaMs;
    p.graphics.y += p.vy * deltaMs;
    p.graphics.alpha = 0.8 * (1 - p.life / p.maxLife);
  }

  // 2. Spawn new particles
  state.spawnTimer += deltaMs;
  if (state.spawnTimer >= state.spawnRate && state.particles.length < state.maxParticles) {
    state.spawnTimer = 0;
    
    const graphics = new Graphics();
    graphics.beginFill(state.color);
    graphics.drawRect(0, 0, 3, 3);
    graphics.endFill();
    
    // Spawn at random edge of sprite (assumed 32x32)
    const angle = Math.random() * Math.PI * 2;
    const speed = 0.02 + Math.random() * 0.03;
    
    const p: Particle = {
      graphics,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0,
      maxLife: 600,
    };
    
    // Offset from center
    graphics.x = (Math.random() - 0.5) * 16;
    graphics.y = (Math.random() - 0.5) * 16;
    
    state.container.addChild(graphics);
    state.particles.push(p);
  }
}

/**
 * Cleans up the emitter for a specific sprite.
 */
export function cleanupEmitter(sprite: Sprite): void {
  const state = emitters.get(sprite);
  if (state) {
    state.particles.forEach(p => p.graphics.destroy());
    state.container.destroy();
    emitters.delete(sprite);
    activeSprites.delete(sprite);
  }
}

/**
 * Disposes all active emitters.
 */
export function disposeAllEmitters(): void {
  for (const sprite of activeSprites) {
    cleanupEmitter(sprite);
  }
}

/**
 * For testing purposes: expose color mapping.
 */
export function _getColorForBehavior(behaviorType: AIBehaviorType): number {
  return getColorForBehavior(behaviorType);
}
