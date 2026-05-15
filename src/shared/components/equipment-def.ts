import { z } from 'zod';
import { defineComponent } from '@engine/ecs/types';

export const EquipmentDef = defineComponent('equipmentDef', z.object({ 
  slotType: z.enum(['weapon', 'armor']), 
  name: z.string() 
}));
