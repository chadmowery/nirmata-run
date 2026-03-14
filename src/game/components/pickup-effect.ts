import { defineComponent } from '../../engine/ecs/types';
import { z } from 'zod';

export enum EffectType {
  HEAL = 'heal',
}

/**
 * Defines the effect applied to an entity when it picks up this item.
 */
export const PickupEffect = defineComponent(
  'pickupEffect',
  z.object({
    type: z.nativeEnum(EffectType),
    value: z.number(),
  })
);

export type PickupEffectData = z.infer<typeof PickupEffect.schema>;
