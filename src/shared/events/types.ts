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
  ENTITY_DIED: { entityId: EntityId; killerId: EntityId; isPlayer: boolean };
  
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

  /** Queued when an entity's Stability level changes. */
  STABILITY_CHANGED: {
    entityId: EntityId;
    oldValue: number;
    newValue: number;
    reason: 'floor_entry' | 'turn_bleed' | 'anchor_refill';
  };

  /** Queued when an entity's Stability reaches zero. */
  STABILITY_ZERO: { entityId: EntityId };

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

  /** Queued when a Software item is burned onto an equipment slot. */
  SOFTWARE_BURNED: {
    entityId: EntityId;
    softwareId: EntityId;
    targetSlot: 'weapon' | 'armor';
  };

  /** Queued when a Software modifier is applied during combat resolution. */
  SOFTWARE_MODIFIER_APPLIED: {
    entityId: EntityId;
    softwareType: string;
    magnitude: number;
  };

  /** Queued when the run-scoped software inventory changes. */
  RUN_INVENTORY_CHANGED: {
    sessionId: string;
    action: 'added' | 'removed' | 'cleared';
    slotCount: number;
  };

  /** Queued when an item drops as currency. */
  CURRENCY_DROPPED: {
    entityId: EntityId;
    currencyType: 'scrap' | 'blueprint' | 'flux';
    amount: number;
    x: number;
    y: number;
    blueprintId?: string;
  };

  /** Queued when a currency item is picked up. */
  CURRENCY_PICKED_UP: {
    entityId: EntityId;
    currencyType: 'scrap' | 'blueprint' | 'flux';
    amount: number;
    blueprintId?: string;
  };

  /** Queued when a Buffer-Overflow pack member detonates. */
  PACK_DETONATION: {
    entityId: EntityId;
    x: number;
    y: number;
    packId: string;
    damage: number;
  };

  /** Queued after floor generation completes. */
  FLOOR_TRANSITION: { floorNumber: number; depthBand: string };

  /** Queued when player steps on staircase. */
  STAIRCASE_INTERACTION: { entityId: EntityId; staircaseId: EntityId; targetFloor: number };

  /** Queued when floor transition is confirmed. */
  STAIRCASE_DESCEND_TRIGGERED: { entityId: EntityId; targetFloor: number; runSeed: string };

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

  /** Queued when an enemy teleports (e.g., Null-Pointer). */
  ENEMY_TELEPORTED: {
    entityId: EntityId;
    fromX: number;
    fromY: number;
    toX: number;
    toY: number;
  };

  /** Queued when the run ends (e.g., via System_Admin). */
  RUN_ENDED: {
    reason: string;
    floorNumber: number;
    stats: Record<string, unknown>;
    entityId?: EntityId;
  };

  /** Queued when a Dead Zone tile is created. */
  DEAD_ZONE_CREATED: { x: number; y: number; duration: number; creatorId: EntityId };
  
  /** Queued when a Dead Zone tile expires. */
  DEAD_ZONE_EXPIRED: { x: number; y: number };
  
  /** Queued when an entity performs a ranged attack. */
  RANGED_ATTACK: { attackerId: EntityId; defenderId: EntityId; damage: number; projectileType: string };

  /** Queued when a tile is corrupted. */
  TILE_CORRUPTED: { x: number; y: number; newType: 'wall' | 'floor'; corruptorId: EntityId };

  /** Queued when an entity is displaced due to corruption. */
  ENTITY_DISPLACED: { entityId: EntityId; fromX: number; fromY: number; toX: number; toY: number };

  /** Queued when a Seed_Eater spawns a subprocess. */
  SUB_PROCESS_SPAWNED: { parentId: EntityId; childId: EntityId; templateName: string };

  /** Queued when a System_Admin is first detected. */
  ADMIN_DETECTED: { floorId?: number };

  /** Queued when the run inventory is synchronized from the server. */
  RUN_INVENTORY_SYNCED: { sessionId: string };
}
