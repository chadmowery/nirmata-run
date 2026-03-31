import { defineComponent } from '@engine/ecs/types';
import { z } from 'zod';

export const StaircaseMarker = defineComponent('staircaseMarker', z.object({
  targetFloor: z.number().int().min(2), // The floor this staircase leads to
}));

export type StaircaseMarkerData = z.infer<typeof StaircaseMarker.schema>;
