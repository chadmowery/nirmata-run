import { z } from 'zod';
import { defineComponent } from '@engine/ecs/types';

/**
 * Marker component for entities that are hostile to the player.
 * Triggers bump-to-attack when the player tries to move into their tile.
 */
export const Hostile = defineComponent('hostile', z.object({}));
