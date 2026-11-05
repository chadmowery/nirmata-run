import { defineComponent } from '@engine/ecs/types';
import { z } from 'zod';
import { SectorConditionSchema } from './environment';

export const FloorState = defineComponent(
  'floorState',
  z.object({
    currentFloor: z.number().int().min(1),
    maxFloor: z.number().int().min(1).default(15),
    runSeed: z.string(),
    sectorCondition: SectorConditionSchema.default('NOMINAL').optional(),
    accessKeysHeld: z.number().int().min(0).default(0).optional(),
    vaultsBreached: z.number().int().min(0).default(0).optional(),
    trapsDisarmed: z.number().int().min(0).default(0).optional(),
  }),
);

export type FloorStateData = z.infer<typeof FloorState.schema>;
