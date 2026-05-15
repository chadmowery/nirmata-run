import { z } from 'zod';
import { defineComponent } from '@engine/ecs/types';

export const Parent = defineComponent('parent', z.object({ 
  entityId: z.number(), 
  slotComponent: z.string().optional() 
}));
