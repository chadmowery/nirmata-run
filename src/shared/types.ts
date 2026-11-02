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
  targetX: z.number().int().optional(),
  targetY: z.number().int().optional(),
});

export const WaitActionSchema = z.object({
  type: z.literal('WAIT'),
});

export const EquipActionSchema = z.object({
  type: z.literal('EQUIP'),
  shellId: z.string(),
  slotType: z.enum(['firmware', 'augment', 'software', 'weapon', 'armor']),
  itemEntityId: z.number(),
});

export const UnequipActionSchema = z.object({
  type: z.literal('UNEQUIP'),
  slotType: z.enum(['firmware', 'augment', 'software', 'weapon', 'armor']),
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
  runInventoryIndex: z.number().int().min(0).max(50).optional(),
  softwareEntityId: z.number().int().optional(),
  targetSlot: z.enum(['weapon', 'armor']),
});

export const PurgeSoftwareActionSchema = z.object({
  type: z.literal('PURGE_SOFTWARE'),
  targetSlot: z.enum(['weapon', 'armor']),
});

export const BurnFirmwareActionSchema = z.object({
  type: z.literal('BURN_FIRMWARE'),
  firmwareEntityId: z.number().int(),
  slotIndex: z.number().int().min(0).max(2),
});

export const BurnAugmentActionSchema = z.object({
  type: z.literal('BURN_AUGMENT'),
  augmentEntityId: z.number().int(),
  slotIndex: z.number().int().min(0).max(3).optional(),
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
  currencyType: z.enum(['scrap', 'blueprint', 'flux', 'nanites']),
  amount: z.number().int().min(1),
});

export const UseConsumableActionSchema = z.object({
  type: z.literal('USE_CONSUMABLE'),
  inventoryIndex: z.number().int(),
  targetEntityId: z.number().int().optional(),
});

export const DebugActionSchema = z.object({
  type: z.literal('DEBUG_COMMAND'),
  command: z.string(),
  args: z.record(z.string(), z.any()).optional(),
});

export const InventorySwapActionSchema = z.object({
  type: z.literal('INVENTORY_SWAP'),
  sourceIndex: z.number().int(),
  destinationIndex: z.number().int(),
});

export const AbortRunActionSchema = z.object({
  type: z.literal('ABORT_RUN'),
});

export const DropItemActionSchema = z.object({
  type: z.literal('DROP_ITEM'),
  itemEntityId: z.number().int(),
  targetX: z.number().int().optional(),
  targetY: z.number().int().optional(),
});

export const InteractPropActionSchema = z.object({
  type: z.literal('INTERACT_PROP'),
  targetPropId: z.number().int(),
  forceOverride: z.boolean().default(false),
  deadDropSelectionId: z.union([z.number().int(), z.string()]).optional(),
});

export const DeadDropItemActionSchema = z.object({
  type: z.literal('DEAD_DROP_ITEM'),
  targetPropId: z.number().int(),
  itemId: z.union([z.number().int(), z.string()]),
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
  DebugActionSchema,
  InventorySwapActionSchema,
  AbortRunActionSchema,
  InteractPropActionSchema,
  DeadDropItemActionSchema,
  UseConsumableActionSchema,
  PurgeSoftwareActionSchema,
  BurnFirmwareActionSchema,
  BurnAugmentActionSchema,
  DropItemActionSchema,
]);

export type ActionIntent = z.infer<typeof ActionIntentSchema>;

export const ActionRequestSchema = z.object({
  sessionId: z.string(),
  action: ActionIntentSchema,
});

export type ActionRequest = z.infer<typeof ActionRequestSchema>;

import { Changeset } from 'json-diff-ts';
import { TurnPhase } from '@engine/turn/types';
import { SerializedTile as EngineSerializedTile } from '@engine/grid/types';

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
export const SerializedTileSchema: z.ZodType<EngineSerializedTile> = z.object({
  terrain: z.string(),
  walkable: z.boolean(),
  transparent: z.boolean(),
  entities: z.array(z.number()),
  items: z.array(z.number()),
});

export type SerializedTile = EngineSerializedTile;

export const SerializedGridSchema = z.object({
  width: z.number(),
  height: z.number(),
  tiles: z.array(SerializedTileSchema),
});

export type SerializedGrid = z.infer<typeof SerializedGridSchema>;

export interface ComponentPatch {
  component: string;
  entityId: number;
  data: unknown;
}

export interface ComponentRemoval {
  component: string;
  entityId: number;
}

export interface ECSWorldDelta {
  nextId: number;
  entitiesAdded: number[];
  entitiesRemoved: number[];
  componentsSet: ComponentPatch[];
  componentsRemoved: ComponentRemoval[];
}

/**
 * Polymorphic payload for state synchronization.
 * DELTA: Incremental changes. Sends fine-grained ECSWorldDelta and grid Changeset.
 * FULL: Complete state snapshot. Best for massive structural changes (e.g., floor transitions).
 */
export type DeltaPayload = {
  type: 'DELTA';
  worldDelta?: ECSWorldDelta;
  world?: SerializedWorld;
  grid: Changeset;
  events?: Array<{ type: string; payload: unknown }>;
  turnNumber: number;
  playerId: number;
};

export type FullSyncPayload = {
  type: 'FULL';
  world: SerializedWorld;
  grid: SerializedGrid;
  events?: Array<{ type: string; payload: unknown }>;
  turnNumber: number;
  playerId: number;
  phase: TurnPhase;
};

export type StateDelta = {
  world: Changeset;
  grid: Changeset;
};

export type SyncPayload = DeltaPayload | FullSyncPayload;
