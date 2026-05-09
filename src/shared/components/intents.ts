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
  })
);

/**
 * Intent to attack a specific target.
 */
export const AttackIntent = defineComponent(
  'attackIntent',
  z.object({
    targetId: z.number(),
  })
);

/**
 * Intent to vent heat.
 */
export const VentIntent = defineComponent(
  'ventIntent',
  z.object({})
);

/**
 * Intent to deal direct damage to a target.
 */
export const DamageIntent = defineComponent(
  'damageIntent',
  z.object({
    targetId: z.number(),
    amount: z.number(), // Raw damage before defense
  })
);

/**
 * Intent to descend to the next floor.
 */
export const DescentIntent = defineComponent(
  'descentIntent',
  z.object({
    targetFloor: z.number(),
    cost: z.number(),
  })
);

/**
 * Intent to extract from the run.
 */
export const ExtractionIntent = defineComponent(
  'extractionIntent',
  z.object({
    reason: z.string(),
  })
);

/**
 * Intent to equip an item.
 */
export const EquipIntent = defineComponent(
  'equipIntent',
  z.object({
    slotType: z.enum(['firmware', 'software', 'augment']),
    itemEntityId: z.number(),
  })
);

/**
 * Intent to unequip a slot.
 */
export const UnequipIntent = defineComponent(
  'unequipIntent',
  z.object({
    slotType: z.enum(['firmware', 'software', 'augment']),
    slotIndex: z.number(),
  })
);

/**
 * Tag indicating that shell stats need to be re-synchronized.
 */
export const ShellUpdateTag = defineComponent(
  'shellUpdateTag',
  z.object({})
);
