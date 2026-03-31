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

  /** Queued when a dungeon is fully generated and populated. */
  DUNGEON_GENERATED: { seed: string };

  /** Queued when the game state machine transitions. */
  STATE_TRANSITION: { newState: string };

  /** Queued when the player's FOV is recalculated. */
  FOV_UPDATED: { visibleSet: Set<string> };

  /** Queued when the player enters targeting mode for a Firmware ability. */
  TARGETING_STARTED: { firmwareSlotIndex: number; range: number; effectType: string };

  /** Queued when the player cancels targeting mode. */
  TARGETING_CANCELLED: Record<string, never>;

  /** Queued when the player confirms a target in targeting mode. */
  TARGETING_CONFIRMED: { targetX: number; targetY: number };

  /** Queued when a world-space filter should be applied (e.g., Anchor desaturation). */
  APPLY_WORLD_FILTER: { filterType: 'grayscale' | 'desaturation'; amount?: number };

  /** Queued when a world-space filter should be removed. */
  REMOVE_WORLD_FILTER: { filterType: 'grayscale' | 'desaturation' };

  /** Queued when the player makes a decision at an anchor (Extract or Descend). */
  ANCHOR_DECISION_MADE: { decision: 'extract' | 'descend' };
}
