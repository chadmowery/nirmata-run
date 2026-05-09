import { z } from 'zod';
import { defineComponent } from '@engine/ecs/types';

export const Dying = defineComponent(
  'Dying',
  z.object({
    killerId: z.number().optional(),
    reason: z.string().optional(),
  })
);
