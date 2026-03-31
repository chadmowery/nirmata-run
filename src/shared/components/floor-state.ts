import { defineComponent } from '@engine/ecs/types';
import { z } from 'zod';

export const FloorState = defineComponent('floorState', z.object({
  currentFloor: z.number().int().min(1),
  maxFloor: z.number().int().min(1).default(15),
  runSeed: z.string(),
}));

export type FloorStateData = z.infer<typeof FloorState.schema>;
