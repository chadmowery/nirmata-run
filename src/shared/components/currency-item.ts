import { defineComponent } from '@engine/ecs/types';
import { z } from 'zod';

export const CurrencyItem = defineComponent('currencyItem', z.object({
  currencyType: z.enum(['scrap', 'blueprint', 'flux']),
  amount: z.number().int().min(1).default(1),
  blueprintId: z.string().optional(),
  blueprintType: z.enum(['firmware', 'augment']).optional(),
}));

export type CurrencyItemData = z.infer<typeof CurrencyItem.schema>;
