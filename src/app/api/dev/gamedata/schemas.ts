import { z } from 'zod';

const SpawnTemplateEntry = z.object({
  name: z.string().min(1),
  weight: z.number().int().positive(),
  isPack: z.boolean().optional(),
  packSize: z.object({ min: z.number().int().positive(), max: z.number().int().positive() }).optional(),
  maxPerFloor: z.number().int().positive().optional(),
  minDistanceFromPlayer: z.number().int().positive().optional(),
});

const SpawnTableEntry = z.object({
  depthRange: z.object({ min: z.number().int().min(0), max: z.number().int().positive() }),
  enemiesPerRoom: z.object({ min: z.number().int().min(0), max: z.number().int().positive() }),
  templates: z.array(SpawnTemplateEntry).min(1),
});

export const SpawnTableSchema = z.object({
  tables: z.array(SpawnTableEntry).min(1),
});

export type SpawnTable = z.infer<typeof SpawnTableSchema>;

export const RawTemplateSchema = z.object({
  name: z.string().regex(/^[a-z0-9-]+$/),
  mixins: z.array(z.string()).optional(),
  components: z.record(z.string(), z.unknown()).optional(),
  overrides: z.record(z.string(), z.record(z.string(), z.unknown())).optional(),
});

export function validateTemplate(data: unknown) {
  return RawTemplateSchema.safeParse(data);
}
