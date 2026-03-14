import { EntityId } from '@engine/ecs/types';

/**
 * Game-specific domain events.
 */
export interface GameEvents {
  /** Queued when an entity deals damage to another. */
  DAMAGE_DEALT: { attackerId: EntityId; defenderId: EntityId; amount: number };
  
  /** Queued when an entity's health reaches zero. */
  ENTITY_DIED: { entityId: EntityId; killerId: EntityId };
  
  /** Queued when an entity picks up an item. */
  ITEM_PICKED_UP: { entityId: EntityId; itemId: EntityId };

  /** Queued when an entity attempts to move into a hostile entity. */
  BUMP_ATTACK: { attackerId: EntityId; defenderId: EntityId };
}
