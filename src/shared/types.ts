import { z } from 'zod';

/**
 * Action Intent Schemas
 */
export const MoveActionSchema = z.object({
  type: z.literal('MOVE'),
  dx: z.number(),
  dy: z.number(),
});

export const AttackActionSchema = z.object({
  type: z.literal('ATTACK'),
  targetId: z.number(),
});

export const PickupActionSchema = z.object({
  type: z.literal('PICKUP'),
  itemId: z.number(),
});

export const WaitActionSchema = z.object({
  type: z.literal('WAIT'),
});

export const EquipActionSchema = z.object({
  type: z.literal('EQUIP'),
  shellId: z.string(),
  slotType: z.enum(['firmware', 'augment', 'software']),
  itemEntityId: z.number(),
});

export const UnequipActionSchema = z.object({
  type: z.literal('UNEQUIP'),
  slotType: z.enum(['firmware', 'augment', 'software']),
  slotIndex: z.number(),
});

export const SelectShellActionSchema = z.object({
  type: z.literal('SELECT_SHELL'),
  shellId: z.string(),
});

export const UpgradeShellActionSchema = z.object({
  type: z.literal('UPGRADE_SHELL'),
  shellId: z.string(),
});

export const UseFirmwareActionSchema = z.object({
  type: z.literal('USE_FIRMWARE'),
  slotIndex: z.number().int().min(0).max(2),
  targetX: z.number().int(),
  targetY: z.number().int(),
});

export const VentActionSchema = z.object({
  type: z.literal('VENT'),
});

export const BurnSoftwareActionSchema = z.object({
  type: z.literal('BURN_SOFTWARE'),
  runInventoryIndex: z.number().int().min(0).max(4),
  targetSlot: z.enum(['weapon', 'armor']),
});

export const MoveAndUseFirmwareActionSchema = z.object({
  type: z.literal('MOVE_AND_USE_FIRMWARE'),
  dx: z.number(),
  dy: z.number(),
  firmwareSlotIndex: z.number().int().min(0).max(2),
  targetX: z.number().int(),
  targetY: z.number().int(),
});

export const AnchorDescendActionSchema = z.object({
  type: z.literal('ANCHOR_DESCEND'),
  anchorId: z.number(),
  cost: z.number(),
});

export const AnchorExtractActionSchema = z.object({
  type: z.literal('ANCHOR_EXTRACT'),
});

export const StaircaseDescendActionSchema = z.object({
  type: z.literal('STAIRCASE_DESCEND'),
  staircaseId: z.number(),
  targetFloor: z.number(),
});

export const PickupCurrencyActionSchema = z.object({
  type: z.literal('PICKUP_CURRENCY'),
  itemId: z.number(),
  currencyType: z.enum(['scrap', 'blueprint', 'flux']),
  amount: z.number().int().min(1),
});

export const ActionIntentSchema = z.discriminatedUnion('type', [
  MoveActionSchema,
  AttackActionSchema,
  PickupActionSchema,
  WaitActionSchema,
  EquipActionSchema,
  UnequipActionSchema,
  SelectShellActionSchema,
  UpgradeShellActionSchema,
  UseFirmwareActionSchema,
  VentActionSchema,
  BurnSoftwareActionSchema,
  MoveAndUseFirmwareActionSchema,
  AnchorDescendActionSchema,
  AnchorExtractActionSchema,
  StaircaseDescendActionSchema,
  PickupCurrencyActionSchema,
]);

export type ActionIntent = z.infer<typeof ActionIntentSchema>;

export const ActionRequestSchema = z.object({
  sessionId: z.string(),
  action: ActionIntentSchema,
});

export type ActionRequest = z.infer<typeof ActionRequestSchema>;

/**
 * Serialized World Schemas
 */
export const SerializedWorldSchema = z.object({
  nextId: z.number(),
  entities: z.array(z.number()),
  stores: z.record(z.string(), z.record(z.string(), z.any())), // EntityId as string key in JSON Record
});

export type SerializedWorld = z.infer<typeof SerializedWorldSchema>;

/**
 * Serialized Grid Schemas
 */
export const SerializedTileSchema = z.object({
  terrain: z.string(),
  walkable: z.boolean(),
  transparent: z.boolean(),
  entities: z.array(z.number()),
  items: z.array(z.number()),
});

export type SerializedTile = z.infer<typeof SerializedTileSchema>;

export const SerializedGridSchema = z.object({
  width: z.number(),
  height: z.number(),
  tiles: z.array(SerializedTileSchema),
});

export type SerializedGrid = z.infer<typeof SerializedGridSchema>;

import { Changeset } from 'json-diff-ts';
import { TurnPhase } from '@engine/turn/types';

export interface RunInventoryItem {
  entityId: number;
  templateId: string;
  rarityTier: string;
  pickedUpAtFloor: number;
  pickedUpAtTimestamp: number;
}

export interface CurrencyStack {
  currencyType: 'scrap' | 'blueprint' | 'flux';
  amount: number;
  blueprintId?: string;
  blueprintType?: 'firmware' | 'augment';
}

export interface RunInventory {
  sessionId: string;
  maxSlots: number;
  software: RunInventoryItem[];
  currency: CurrencyStack[];
}

/**
 * Polymorphic payload for state synchronization.
 * DELTA: Incremental changes using json-diff-ts. Best for small performance-critical updates.
 * FULL: Complete state snapshot. Best for massive structural changes (e.g., floor transitions).
 */
export type DeltaPayload = {
  type: 'DELTA';
  world: SerializedWorld;
  grid: Changeset;
  events?: Array<{ type: string; payload: unknown }>;
  turnNumber: number;
  playerId: number;
  runInventory?: RunInventory; // Serialized RunInventory state
};

export type FullSyncPayload = {
  type: 'FULL';
  world: SerializedWorld;
  grid: SerializedGrid;
  events?: Array<{ type: string; payload: unknown }>;
  turnNumber: number;
  playerId: number;
  phase: TurnPhase;
  runInventory?: RunInventory; // Serialized RunInventory state
};

export type StateDelta = {
  world: Changeset;
  grid: Changeset;
};

export type SyncPayload = DeltaPayload | FullSyncPayload;
