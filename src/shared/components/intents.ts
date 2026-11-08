import { z } from 'zod';
import { defineComponent } from '@engine/ecs/types';

/**
 * Intent to move in a specific direction.
 */
export const MoveIntent = defineComponent(
  'moveIntent',
  z.object({
    dx: z.number(),
    dy: z.number(),
  }),
);

/**
 * Intent to attack a specific target.
 */
export const AttackIntent = defineComponent(
  'attackIntent',
  z.object({
    targetId: z.number(),
  }),
);

/**
 * Intent to vent heat.
 */
export const VentIntent = defineComponent('ventIntent', z.object({}));

/**
 * Intent to deal direct damage to a target.
 */
export const DamageIntent = defineComponent(
  'damageIntent',
  z.object({
    attackerId: z.number().optional(),
    targetId: z.number(),
    amount: z.number(), // Raw damage before defense
    damageType: z.enum(['physical', 'neural', 'environmental']).optional(),
  }),
);

/**
 * Intent indicating an entity was alerted by an acoustic event.
 * Consumed by AISystem in Phase.GATHER_INTENT to update FovAwareness and AIState.
 */
export const AlertIntent = defineComponent(
  'alertIntent',
  z.object({
    sourceX: z.number(),
    sourceY: z.number(),
  }),
);

/**
 * Intent to descend to the next floor.
 */
export const DescentIntent = defineComponent(
  'descentIntent',
  z.object({
    targetFloor: z.number(),
    cost: z.number(),
  }),
);

/**
 * Intent to extract from the run.
 */
export const ExtractionIntent = defineComponent(
  'extractionIntent',
  z.object({
    reason: z.string(),
  }),
);

/**
 * Intent to equip an item.
 */
export const EquipIntent = defineComponent(
  'equipIntent',
  z.object({
    slotType: z.enum(['firmware', 'software', 'augment', 'weapon', 'armor']),
    itemEntityId: z.number(),
  }),
);

/**
 * Intent to unequip a slot.
 */
export const UnequipIntent = defineComponent(
  'unequipIntent',
  z.object({
    slotType: z.enum(['firmware', 'software', 'augment', 'weapon', 'armor']),
    slotIndex: z.number(),
  }),
);

/**
 * Intent to teleport to a specific coordinate.
 */
export const TeleportIntent = defineComponent(
  'teleportIntent',
  z.object({
    x: z.number(),
    y: z.number(),
  }),
);

/**
 * Intent to apply a status effect to a target.
 */
export const ApplyStatusEffectIntent = defineComponent(
  'applyStatusEffectIntent',
  z.object({
    targetId: z.number(),
    effect: z.object({
      name: z.string(),
      duration: z.number(),
      magnitude: z.number().optional(),
      severity: z.string().optional(),
      source: z.string().optional(),
    }),
  }),
);

/**
 * Intent to heal a target.
 */
export const HealIntent = defineComponent(
  'healIntent',
  z.object({
    targetId: z.number(),
    amount: z.number(),
  }),
);

/**
 * Intent to change heat for a target.
 */
export const HeatIntent = defineComponent(
  'heatIntent',
  z.object({
    targetId: z.number(),
    amount: z.number(), // positive for add, negative for remove
  }),
);

/**
 * Intent to burn software onto a slot.
 */
export const BurnSoftwareIntent = defineComponent(
  'burnSoftwareIntent',
  z.object({
    actorId: z.number(),
    softwareEntityId: z.number(),
    targetSlot: z.enum(['weapon', 'armor']),
    inventoryIndex: z.number(),
    isEquipmentList: z.boolean().optional(),
  }),
);

/**
 * Intent to activate a firmware ability.
 */
export const FirmwareIntent = defineComponent(
  'firmwareIntent',
  z.object({
    actorId: z.number(),
    slotIndex: z.number(),
    targetX: z.number().optional(),
    targetY: z.number().optional(),
  }),
);

/**
 * Tag indicating an entity is currently taking its turn.
 */
export const Acting = defineComponent('acting', z.object({}));

/**
 * Tag indicating that an actor's turn action was halted/aborted with 0 turn cost
 * (e.g. Two-Tier Bump Safeguard).
 */
export const ActionAbortedTag = defineComponent('actionAbortedTag', z.object({}));

/**
 * Tag indicating that shell stats need to be re-synchronized.
 */
export const ShellUpdateTag = defineComponent('shellUpdateTag', z.object({}));

/**
 * Intent to pick up an item.
 */
export const PickupIntent = defineComponent(
  'pickupIntent',
  z.object({
    actorId: z.number(),
    itemId: z.number(),
    targetX: z.number().int().optional(),
    targetY: z.number().int().optional(),
  }),
);

/**
 * Intent to drop an item from inventory onto a floor tile.
 */
export const DropItemIntent = defineComponent(
  'dropItemIntent',
  z.object({
    actorId: z.number(),
    itemEntityId: z.number(),
    targetX: z.number().int(),
    targetY: z.number().int(),
  }),
);

/**
 * Intent to spawn one or more entities onto the world and spatial grid in Phase.ACTION.
 */
export const SpawnEntityIntent = defineComponent(
  'spawnEntityIntent',
  z.object({
    spawnerId: z.number().int(),
    spawns: z.array(
      z.object({
        templateName: z.string(),
        x: z.number().int(),
        y: z.number().int(),
        overrides: z.record(z.string(), z.record(z.string(), z.unknown())).optional(),
      }),
    ),
  }),
);

