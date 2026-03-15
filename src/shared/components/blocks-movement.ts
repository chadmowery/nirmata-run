import { z } from 'zod';
import { defineComponent } from '@engine/ecs/types';

/**
 * Marker component for entities that block movement.
 */
export const BlocksMovement = defineComponent('blocksMovement', z.object({}));
