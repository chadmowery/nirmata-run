import { z } from 'zod';
import { defineComponent } from '@engine/ecs/types';

export const Children = defineComponent('children', z.object({ 
  entityIds: z.array(z.number()).default([]) 
}));
