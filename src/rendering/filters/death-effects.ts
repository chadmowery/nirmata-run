import { Sprite } from 'pixi.js';
import { EntityId } from '@engine/ecs/types';
import { AIBehaviorType } from '@shared/components/ai-state';
import { queueDeathAnimation } from '../animations';

/**
 * Queues a unique death animation for an enemy based on its behavior type.
 */
export function queueTypedDeathAnimation(
  entityId: EntityId,
  behaviorType: AIBehaviorType,
  sprite: Sprite,
  onComplete: () => void
): void {
  let type: 'fade-out' | 'death-flicker' | 'death-explode' | 'death-crumble' | 'death-static' | 'death-collapse' = 'fade-out';

  switch (behaviorType) {
    case AIBehaviorType.NULL_POINTER:
      type = 'death-flicker';
      break;
    case AIBehaviorType.BUFFER_OVERFLOW:
      type = 'death-explode';
      break;
    case AIBehaviorType.FRAGMENTER:
      type = 'death-crumble';
      break;
    case AIBehaviorType.LOGIC_LEAKER:
      type = 'death-static';
      break;
    case AIBehaviorType.SEED_EATER:
      type = 'death-collapse';
      break;
    default:
      type = 'fade-out';
      break;
  }

  // We pass the type to queueDeathAnimation. 
  // We need to ensure queueDeathAnimation (in src/rendering/animations.ts)
  // supports these types.
  queueDeathAnimation(entityId, onComplete, type);
}
