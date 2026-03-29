import { GameplayEvents } from '@shared/events/types';

/**
 * Client-only, UI-bound, or rendering-specific events.
 * Never emitted or consumed by server-side code.
 */
export interface GameEvents extends GameplayEvents {
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
}
