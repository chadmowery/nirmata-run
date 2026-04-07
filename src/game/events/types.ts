import { GameplayEvents } from '@shared/events/types';
import { EntityId } from '@engine/ecs/types';

/**
 * Client-only, UI-bound, or rendering-specific events.
 * Never emitted or consumed by server-side code.
 */
export interface GameEvents extends GameplayEvents {
  /** Queued to flash a geometric shape for augment synergy feedback (D-04). */
  AUGMENT_FLASH: {
    entityId: EntityId;
    count: number;
    augmentNames: string[];
  };
}
