import { EntityId } from '../ecs/types';

/**
 * Core engine lifecycle events.
 */
export interface EngineEvents {
  /** Queued when a new entity is created. */
  ENTITY_CREATED: { entityId: EntityId };
  
  /** Queued when an entity is destroyed. */
  ENTITY_DESTROYED: { entityId: EntityId };
  
  /** Queued when a component is added to an entity. */
  COMPONENT_ADDED: { entityId: EntityId; componentKey: string };
  
  /** Queued when a component is removed from an entity. */
  COMPONENT_REMOVED: { entityId: EntityId; componentKey: string };

  /** Queued when a turn cycle starts. */
  TURN_START: { turnNumber: number };

  /** Queued when a turn cycle ends. */
  TURN_END: { turnNumber: number };
}
