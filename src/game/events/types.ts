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
}
