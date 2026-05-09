import { z } from 'zod';
import { defineComponent } from '../../engine/ecs/types';

export const FloorTransitioned = defineComponent('floorTransitioned', z.object({
  floorNumber: z.number(),
}));
