import { defineComponent } from '@engine/ecs/types';
import { z } from 'zod';

/**
 * Component that stores the name of the template used to create the entity.
 * Critical for inventory persistence and extraction mapping.
 */
export const TemplateId = defineComponent(
  'templateId',
  z.object({
    id: z.string(),
  })
);

export type TemplateIdData = z.infer<typeof TemplateId.schema>;
