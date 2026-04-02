import { defineComponent } from '@engine/ecs/types';
import { z } from 'zod';

export const Wallet = defineComponent('wallet', z.object({
  scrap: z.number().int().min(0).default(0),
  flux: z.number().int().min(0).default(0),
  scrapCap: z.number().int().positive().default(10000),
  fluxCap: z.number().int().positive().default(1000),
}));

export type WalletData = z.infer<typeof Wallet.schema>;
