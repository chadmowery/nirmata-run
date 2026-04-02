import { defineComponent } from '@engine/ecs/types';
import { z } from 'zod';

/**
 * Component representing scrap currency (legacy).
 * @deprecated Use CurrencyItem component and run inventory currency stacking instead.
 */
export const Scrap = defineComponent('scrap', z.object({
  amount: z.number().int().min(0).default(0),
}));


/**
 * Type-safe data for the Scrap component.
 */
export type ScrapData = z.infer<typeof Scrap.schema>;
