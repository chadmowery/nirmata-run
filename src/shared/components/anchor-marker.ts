import { defineComponent } from '@engine/ecs/types';
import { z } from 'zod';

export const AnchorMarker = defineComponent('anchorMarker', z.object({
  used: z.boolean().default(false), // Breaks after Descend per D-22
}));

export type AnchorMarkerData = z.infer<typeof AnchorMarker.schema>;
