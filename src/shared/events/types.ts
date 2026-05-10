import { EntityId } from '@engine/ecs/types';
import { EngineEvents } from '@engine/events/types';
import { VaultItem } from '../profile';

/**
 * Gameplay-meaningful events that the authoritative pipeline and reconciliation 
 * need to emit or consume. Shared between client & server.
 */
export interface GameplayEvents extends EngineEvents {
  /** Queued when an entity deals damage to another. */
  DAMAGE_DEALT: { attackerId: EntityId; defenderId: EntityId; amount: number };
  
  /** Queued when an entity's health reaches zero. */
  ENTITY_DIED: { entityId: EntityId; killerId: EntityId; isPlayer: boolean };
  
  /** Queued when an entity picks up an item. */
  ITEM_PICKED_UP: { entityId: EntityId; itemId: EntityId };


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
  MESSAGE_EMITTED: { text: string; type: 'info' | 'combat' | 'error' | 'warning' };

  /** Queued when an entity's shell stats are updated. */
  SHELL_STATS_CHANGED: { entityId: EntityId; shellId: string };

  /** Queued when an entity's Stability level changes. */
  STABILITY_CHANGED: {
    entityId: EntityId;
    oldValue: number;
    newValue: number;
    reason: 'floor_entry' | 'turn_bleed' | 'anchor_refill';
  };


  /** Queued when an entity takes damage from a degraded Stability state. */
  DEGRADED_DAMAGE: { entityId: EntityId; damage: number };

  /** Queued when an entity's equipment slots change. */
  EQUIPMENT_CHANGED: { entityId: EntityId; slotType: string };

  /** Queued when a shell is selected for a new run. */
  SHELL_SELECTED: { shellId: string };

  /** Queued when an entity's Heat level changes. */
  HEAT_CHANGED: { entityId: EntityId; oldHeat: number; newHeat: number; maxSafe: number };

  /** Queued when a Firmware ability is activated. */
  FIRMWARE_ACTIVATED: { entityId: EntityId; firmwareEntityId: EntityId; slotIndex: number; abilityName: string; heatCost: number; targetX: number; targetY: number };

  /** Queued when an entity completes a Heat vent. */
  VENT_COMPLETED: { entityId: EntityId; oldHeat: number; newHeat: number };

  /** Queued when a status effect is applied to an entity. */
  STATUS_EFFECT_APPLIED: {
    entityId: EntityId;
    effectName: string;
    duration: number;
    magnitude: number;
    severity?: string;
    source: string;
  };

  /** Queued when a status effect expires on an entity. */
  STATUS_EFFECT_EXPIRED: {
    entityId: EntityId;
    effectName: string;
  };

  /** Queued when the run-scoped software inventory changes. */
  RUN_INVENTORY_CHANGED: {
    sessionId: string;
    action: 'added' | 'removed' | 'cleared';
    slotCount: number;
  };

  /** Queued when a currency item is picked up. */
  CURRENCY_PICKED_UP: {
    entityId: EntityId;
    currencyType: 'scrap' | 'blueprint' | 'flux';
    amount: number;
    blueprintId?: string;
  };

  /** Queued after floor generation completes. */
  FLOOR_TRANSITION: { floorNumber: number; depthBand: string };

  /** Queued when player steps on staircase. */
  STAIRCASE_INTERACTION: { entityId: EntityId; staircaseId: EntityId; targetFloor: number };

  /** Queued when floor transition is confirmed. */

  /** Queued when player steps on anchor. */
  ANCHOR_INTERACTION: { 
    entityId: EntityId; 
    anchorId: EntityId; 
    floorNumber: number;
    stabilityPercent: number;
    inventory: {
      firmware: string[];
      augments: string[];
      software: string[];
      scrap: number;
    };
    descendCost: number;
    nextFloorEnemyTier: string;
    estimatedStabilityAfterDescent: number;
  };

  /** Queued when player chooses to extract at an anchor. */
  ANCHOR_EXTRACT: Record<string, never>;

  /** Queued when player chooses to descend at an anchor. */
  ANCHOR_DESCEND: { anchorId: EntityId; cost: number };
  
  /** Queued when targeting mode starts. */
  TARGETING_STARTED: { firmwareSlotIndex: number; range: number; playerX: number; playerY: number; effectType: string };
  
  /** Queued when targeting is confirmed. */
  TARGETING_CONFIRMED: { targetX: number; targetY: number };
  
  /** Queued when targeting is cancelled. */
  TARGETING_CANCELLED: Record<string, never>;

  /** Queued when the targeting cursor moves. */
  TARGETING_CURSOR_MOVED: { x: number; y: number };

  /** Queued when an enemy teleports (e.g., Null-Pointer). */
  ENEMY_TELEPORTED: {
    entityId: EntityId;
    fromX: number;
    fromY: number;
    toX: number;
    toY: number;
  };

  /** Stats payload for the RUN_ENDED event. */
  RUN_ENDED: {
    reason: string;
    floorNumber: number;
    stats: RunEndedStats;
    entityId?: EntityId;
  };

  /** Queued when the run inventory is synchronized from the server. */
  RUN_INVENTORY_SYNCED: { sessionId: string };

  /** Queued when a dungeon is fully generated and populated. */
  DUNGEON_GENERATED: { seed: string };

  /** Queued when the game state machine transitions. */
  STATE_TRANSITION: { newState: string };

  /** Queued when the player's FOV is recalculated. */
  FOV_UPDATED: { visibleSet: Set<string> };

  /** Queued when a world-space filter should be applied (e.g., Anchor desaturation). */
  APPLY_WORLD_FILTER: { filterType: 'grayscale' | 'desaturation'; amount?: number };

  /** Queued when a world-space filter should be removed. */
  REMOVE_WORLD_FILTER: { filterType: 'grayscale' | 'desaturation' };

  /** Queued when the player makes a decision at an anchor (Extract or Descend). */
  ANCHOR_DECISION_MADE: { 
    decision: 'extract' | 'descend';
    anchorId?: number;
    descendCost?: number;
    floorNumber?: number;
  };

  /** Queued when the player makes a decision at a staircase. */
  STAIRCASE_DECISION_MADE: { confirmed: boolean; targetFloor: number; staircaseId: number };

  /** Queued when a system requests the game to pause (e.g., UI dialog). */
  GAME_PAUSE_REQUESTED: Record<string, never>;

  /** Queued when a system requests the game to resume. */
  GAME_RESUME_REQUESTED: Record<string, never>;

}

export interface RunEndedStats {
  scrapExtracted: number;
  fluxExtracted: number;
  softwareExtracted: number;
  pityAwarded: boolean;
  itemsExtracted: VaultItem[];
}
