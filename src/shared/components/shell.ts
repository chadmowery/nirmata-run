import { z } from 'zod';
import { defineComponent } from '@engine/ecs/types';

export const CardinalDirectionSchema = z.enum(['north', 'east', 'south', 'west']);

export const ShellDirectionalSpritesSchema = z.object({
  north: z.string().optional(),
  east: z.string().optional(),
  south: z.string().optional(),
  west: z.string().optional(),
});

/**
 * Component representing a Shell's base stats.
 */
export const Shell = defineComponent(
  'shell',
  z.object({
    archetypeId: z.string(), // e.g., "striker-v1"
    speed: z.number().int().positive(),
    stability: z.number().int().min(0),
    armor: z.number().int().min(0),
    maxHealth: z.number().int().positive(),
    directionalSprites: ShellDirectionalSpritesSchema.optional(),
    defaultDirection: CardinalDirectionSchema.optional(),
  }),
);

/**
 * Type-safe data for the Shell component.
 */
export type ShellData = z.infer<typeof Shell.schema>;
