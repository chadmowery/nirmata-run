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

  /** Queued when an entity's shell stats are updated. */
  SHELL_STATS_CHANGED: { entityId: EntityId; shellId: string };

  /** Queued when an entity's equipment slots change. */
  EQUIPMENT_CHANGED: { entityId: EntityId; slotType: string };

  /** Queued when a shell is selected for a new run. */
  SHELL_SELECTED: { shellId: string };

  /** Queued when an entity's Heat level changes. */
  HEAT_CHANGED: { entityId: EntityId; oldHeat: number; newHeat: number; maxSafe: number };

  /** Queued when a Firmware ability is activated. */
  FIRMWARE_ACTIVATED: { entityId: EntityId; firmwareEntityId: EntityId; slotIndex: number; abilityName: string; heatCost: number; targetX: number; targetY: number };

  /** Queued when a Kernel Panic roll triggers a consequence. */
  KERNEL_PANIC_TRIGGERED: { entityId: EntityId; tier: number; effectName: string; severity: string };

  /** Queued when an entity completes a Heat vent. */
  VENT_COMPLETED: { entityId: EntityId; oldHeat: number; newHeat: number };

  /** Queued when a toggle Firmware ability changes state. */
  FIRMWARE_TOGGLED: { entityId: EntityId; firmwareEntityId: EntityId; abilityName: string; active: boolean };

  /** Queued when a status effect is applied to an entity. */
  STATUS_EFFECT_APPLIED: {
    entityId: EntityId;
    effectName: string;
    duration: number;
    magnitude: number;
    source: string;
  };

  /** Queued when a status effect expires on an entity. */
  STATUS_EFFECT_EXPIRED: {
    entityId: EntityId;
    effectName: string;
  };

  /** Queued when one or more Augments trigger from an action. */
  AUGMENT_TRIGGERED: {
    entityId: EntityId;
    augments: Array<{ name: string; payloadType: string; magnitude: number }>;
  };
}
