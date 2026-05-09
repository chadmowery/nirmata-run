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
