import { EntityId } from '@engine/ecs/types';
import { EngineEvents } from '@engine/events/types';

/**
 * Gameplay-meaningful events that the authoritative pipeline and reconciliation 
 * need to emit or consume. Shared between client & server.
 */
export interface GameplayEvents extends EngineEvents {
  /** Queued when an entity deals damage to another. */
  DAMAGE_DEALT: { attackerId: EntityId; defenderId: EntityId; amount: number };
  
  /** Queued when an entity's health reaches zero. */
  ENTITY_DIED: { entityId: EntityId; killerId: EntityId };
  
  /** Queued when an entity picks up an item. */
  ITEM_PICKED_UP: { entityId: EntityId; itemId: EntityId };

  /** Queued when an entity attempts to move into a hostile entity. */
  BUMP_ATTACK: { attackerId: EntityId; defenderId: EntityId };

  /** Queued when the player performs an action. */
  PLAYER_ACTION: { action: string; entityId: EntityId };

  /** Queued after an entity successfully moves. */
  ENTITY_MOVED: { 
    entityId: EntityId; 
    fromX: number; 
    fromY: number; 
    toX: number; 
    toY: number 
  };

  /** Queued when an entity is healed. */
  HEALED: { entityId: EntityId; amount: number };

  /** Queued when an entity gains experience. */
  XP_GAINED: { entityId: EntityId; amount: number };

  /** Queued to emit a message (e.g., to the UI log). */
  MESSAGE_EMITTED: { text: string; type: 'info' | 'combat' | 'error' };
}
