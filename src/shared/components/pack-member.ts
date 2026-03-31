import { z } from 'zod';
import { defineComponent, ComponentData } from '@engine/ecs/types';

/**
 * Component for swarm/pack coordination.
 */
export const PackMember = defineComponent('packMember', z.object({
  packId: z.string(),
  isLeader: z.boolean().default(false),
}));

export type PackMemberData = ComponentData<typeof PackMember>;
