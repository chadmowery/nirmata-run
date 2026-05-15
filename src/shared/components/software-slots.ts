import { z } from 'zod';
import { defineComponent } from '@engine/ecs/types';

export const SoftwareSlots = defineComponent('softwareSlots', z.object({
  maxSlots: z.number().default(3),
  allowedTypes: z.array(z.string()).default(['software']),
  allowedTags: z.array(z.string()).optional(),
  equipped: z.array(z.number()).default([])
}));
