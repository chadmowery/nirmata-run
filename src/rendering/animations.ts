import { Sprite } from 'pixi.js';
import { GlitchFilter, RGBSplitFilter } from 'pixi-filters';
import { EntityId } from '../engine/ecs/types';
import { TILE_SIZE } from './constants';

type DeathType = 'fade-out' | 'death-flicker' | 'death-explode' | 'death-crumble' | 'death-static' | 'death-collapse';

interface TweenAnimation {
  entityId: EntityId;
  type: 'move' | 'attack-lunge' | 'attack-return' | 'death' | DeathType;
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
      case 'fade-out':
        sprite.alpha = 1 - t;
        break;
      case 'death-flicker':
        // Rapidly toggle visibility 6 times over first 400ms (t <= 0.66)
        if (t <= 0.66) {
          sprite.visible = Math.floor(t * 15) % 2 === 0;
        } else {
          sprite.visible = true;
          sprite.alpha = Math.max(0, 1 - (t - 0.66) * 3);
        }
        break;
      case 'death-explode': {
        sprite.scale.set(1 + t * 0.5);
        sprite.alpha = 1 - t;
        // Search for existing RGBSplitFilter or add one
        let explodeSplit = (sprite.filters || []).find(f => f instanceof RGBSplitFilter) as RGBSplitFilter;
        if (!explodeSplit) {
          explodeSplit = new RGBSplitFilter();
          sprite.filters = [...(sprite.filters || []), explodeSplit];
        }
        explodeSplit.red = { x: t * 10, y: 0 };
        explodeSplit.green = { x: 0, y: t * 10 };
        break;
      }
      case 'death-crumble': {
        sprite.alpha = 1 - t;
        let crumbleGlitch = (sprite.filters || []).find(f => f instanceof GlitchFilter) as GlitchFilter;
        if (!crumbleGlitch) {
          crumbleGlitch = new GlitchFilter({ slices: 20 });
          sprite.filters = [...(sprite.filters || []), crumbleGlitch];
        }
        crumbleGlitch.offset = 50 + t * 150;
        break;
      }
      case 'death-static': {
        sprite.alpha = 1 - t;
        sprite.scale.set(1 - t * 0.5);
        let staticGlitch = (sprite.filters || []).find(f => f instanceof GlitchFilter) as GlitchFilter;
        if (!staticGlitch) {
          staticGlitch = new GlitchFilter();
          sprite.filters = [...(sprite.filters || []), staticGlitch];
        }
        staticGlitch.slices = 5 + Math.floor(t * 25);
        break;
      }
      case 'death-collapse': {
        sprite.alpha = 1 - t;
        sprite.scale.set(1 - t * 0.7);
        sprite.rotation += 0.05; // ~0.2 radians over 600ms
        let collapseGlitch = (sprite.filters || []).find(f => f instanceof GlitchFilter) as GlitchFilter;
        if (!collapseGlitch) {
          collapseGlitch = new GlitchFilter({ slices: 5, offset: 8 });
          sprite.filters = [...(sprite.filters || []), collapseGlitch];
        }
        collapseGlitch.offset = 8 + t * 40;
        break;
      }
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
 * Queues a death animation with optional custom type.
 */
export function queueDeathAnimation(
  entityId: EntityId,
  onComplete: () => void,
  type: DeathType = 'fade-out'
): void {
  let duration = 300;
  if (type === 'death-flicker') duration = 600;
  if (type === 'death-explode') duration = 300;
  if (type === 'death-crumble') duration = 500;
  if (type === 'death-static') duration = 400;
  if (type === 'death-collapse') duration = 600;

  activeAnimations.push({
    entityId,
    type,
    startX: 0,
    startY: 0,
    targetX: 0,
    targetY: 0,
    elapsed: 0,
    duration,
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
