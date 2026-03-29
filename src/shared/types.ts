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

export const ActionIntentSchema = z.discriminatedUnion('type', [
  MoveActionSchema,
  AttackActionSchema,
  PickupActionSchema,
  WaitActionSchema,
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

/**
 * State Delta type representing the difference between two world/grid states.
 */
export type StateDelta = {
  world: Changeset;
  grid: Changeset;
};

