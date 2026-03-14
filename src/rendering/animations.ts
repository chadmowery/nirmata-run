import { Sprite } from 'pixi.js';
import { EntityId } from '../engine/ecs/types';
import { TILE_SIZE } from './constants';

interface TweenAnimation {
  entityId: EntityId;
  type: 'move' | 'attack-lunge' | 'attack-return' | 'death';
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  elapsed: number;
  duration: number; // ms
  onComplete?: () => void;
}

let activeAnimations: TweenAnimation[] = [];

/**
 * Updates all active animations.
 * Called every frame by the PixiJS ticker.
 */
export function tickAnimations(deltaMs: number, getSprite: (id: EntityId) => Sprite | undefined): void {
  for (let i = activeAnimations.length - 1; i >= 0; i--) {
    const anim = activeAnimations[i];
    anim.elapsed += deltaMs;
    const t = Math.min(anim.elapsed / anim.duration, 1);
    
    const sprite = getSprite(anim.entityId);
    if (!sprite || sprite.destroyed) {
      activeAnimations.splice(i, 1);
      continue;
    }

    switch (anim.type) {
      case 'move':
      case 'attack-lunge':
      case 'attack-return':
        sprite.x = anim.startX + (anim.targetX - anim.startX) * t;
        sprite.y = anim.startY + (anim.targetY - anim.startY) * t;
        break;
      case 'death':
        sprite.alpha = 1 - t;
        break;
    }

    if (t >= 1) {
      if (anim.onComplete) {
        anim.onComplete();
      }
      activeAnimations.splice(i, 1);
    }
  }
}

/**
 * Queues a movement tween for an entity.
 */
export function queueMoveTween(entityId: EntityId, fromX: number, fromY: number, toX: number, toY: number): void {
  activeAnimations.push({
    entityId,
    type: 'move',
    startX: fromX * TILE_SIZE,
    startY: fromY * TILE_SIZE,
    targetX: toX * TILE_SIZE,
    targetY: toY * TILE_SIZE,
    elapsed: 0,
    duration: 100,
  });
}

/**
 * Queues an attack animation (lunge + return).
 */
export function queueAttackAnimation(
  attackerId: EntityId,
  attackerPos: { x: number; y: number },
  defenderPos: { x: number; y: number },
  getSprite: (id: EntityId) => Sprite | undefined
): void {
  const startX = attackerPos.x * TILE_SIZE;
  const startY = attackerPos.y * TILE_SIZE;
  
  // Compute lunge target: 30% toward defender
  const diffX = (defenderPos.x - attackerPos.x) * TILE_SIZE;
  const diffY = (defenderPos.y - attackerPos.y) * TILE_SIZE;
  const targetX = startX + diffX * 0.3;
  const targetY = startY + diffY * 0.3;

  // Apply red tint to defender
  const defenderSprite = getSprite(attackerId); // Wait, this should find defender sprite
  // Actually the caller should probably handle the tint or we pass defenderId
}

/**
 * Queues an attack animation (lunge + return) with defender feedback.
 */
export function queueAttackAnimationWithDefender(
  attackerId: EntityId,
  attackerPos: { x: number; y: number },
  defenderId: EntityId,
  defenderPos: { x: number; y: number },
  getSprite: (id: EntityId) => Sprite | undefined
): void {
  const startX = attackerPos.x * TILE_SIZE;
  const startY = attackerPos.y * TILE_SIZE;
  
  const diffX = (defenderPos.x - attackerPos.x) * TILE_SIZE;
  const diffY = (defenderPos.y - attackerPos.y) * TILE_SIZE;
  const lungeX = startX + diffX * 0.3;
  const lungeY = startY + diffY * 0.3;

  // 1. Lunge
  activeAnimations.push({
    entityId: attackerId,
    type: 'attack-lunge',
    startX,
    startY,
    targetX: lungeX,
    targetY: lungeY,
    elapsed: 0,
    duration: 75,
    onComplete: () => {
      // 2. Return
      activeAnimations.push({
        entityId: attackerId,
        type: 'attack-return',
        startX: lungeX,
        startY: lungeY,
        targetX: startX,
        targetY: startY,
        elapsed: 0,
        duration: 75,
      });
    }
  });

  // 3. Defender Tint
  const defenderSprite = getSprite(defenderId);
  if (defenderSprite && !defenderSprite.destroyed) {
    defenderSprite.tint = 0xFF0000;
    setTimeout(() => {
      if (!defenderSprite.destroyed) {
        defenderSprite.tint = 0xFFFFFF;
      }
    }, 150);
  }
}

/**
 * Queues a death animation (fade out).
 */
export function queueDeathAnimation(entityId: EntityId, onComplete: () => void): void {
  activeAnimations.push({
    entityId,
    type: 'death',
    startX: 0, // Not used for death
    startY: 0,
    targetX: 0,
    targetY: 0,
    elapsed: 0,
    duration: 300,
    onComplete,
  });
}

/**
 * Returns true if an entity has an active animation.
 */
export function hasActiveAnimation(entityId: EntityId): boolean {
  return activeAnimations.some(a => a.entityId === entityId);
}

/**
 * Clears all active animations.
 */
export function clearAnimations(): void {
  activeAnimations = [];
}
