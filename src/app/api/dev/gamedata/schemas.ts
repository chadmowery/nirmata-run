import { z } from 'zod';

const SpawnTemplateEntry = z.object({
  name: z.string().min(1),
  weight: z.number().int().positive(),
  isPack: z.boolean().optional(),
  packSize: z
    .object({ min: z.number().int().positive(), max: z.number().int().positive() })
    .optional(),
  maxPerFloor: z.number().int().positive().optional(),
  minDistanceFromPlayer: z.number().int().positive().optional(),
});

const SpawnTableEntry = z.object({
  depthRange: z.object({ min: z.number().int().min(0), max: z.number().int().positive() }),
  enemiesPerRoom: z.object({ min: z.number().int().min(0), max: z.number().int().positive() }),
  templates: z.array(SpawnTemplateEntry).min(1),
});

export const SpawnTableSchema = z.object({
  name: z.string().optional(),
  tables: z.array(SpawnTableEntry).min(1),
});

export type SpawnTable = z.infer<typeof SpawnTableSchema>;

export const RawTemplateSchema = z
  .object({
    name: z.string().regex(/^[a-z0-9-]+$/),
    mixins: z.array(z.string()).optional(),
    components: z.record(z.string(), z.unknown()).optional(),
    overrides: z.record(z.string(), z.record(z.string(), z.unknown())).optional(),
  })
  .passthrough();

export function validateTemplate(data: unknown) {
  return RawTemplateSchema.safeParse(data);
}

export const PropAnchorTagSchema = z.enum([
  'PROP_DESK_CORNER',
  'PROP_LOCKER_WALL',
  'SURFACE_TABLE_TOP',
  'CONTAINER_RARE',
]);

export const RoomPortalSchema = z.object({
  x: z.number().int().min(0),
  y: z.number().int().min(0),
  direction: z.enum(['north', 'south', 'east', 'west']),
});

export const PropSpawnDefSchema = z.object({
  x: z.number().int().min(0),
  y: z.number().int().min(0),
  anchorType: PropAnchorTagSchema,
  orientation: z.enum(['NORTH', 'EAST', 'SOUTH', 'WEST']).optional(),
  guaranteedTemplate: z.string().optional(),
});

export const RoomPrefabTemplateSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1),
  archetype: z
    .enum([
      'SERVER_CORE',
      'FREIGHT_BAY',
      'DECON_AIRLOCK',
      'ZERO_DAY_VAULT',
      'SUBNET_HUB',
      'CORRUPTED_SECTOR',
      'CUSTOM',
    ])
    .optional(),
  faction: z.enum(['traxus', 'cyberacme', 'sekiguchi', 'nucaloric']),
  isVaultRoom: z.boolean().optional(),
  faradayShielded: z.boolean().optional(),
  minFloor: z.number().int().min(1).max(15),
  maxFloor: z.number().int().min(1).max(15),
  width: z.number().int().min(10).max(16),
  height: z.number().int().min(10).max(16),
  layout: z.array(z.string().regex(/^[#.+V~]+$/)),
  portals: z.array(RoomPortalSchema).min(1),
  propSpawns: z.array(PropSpawnDefSchema),
});

export const ShellTemplateSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1),
  sprite: z.string().optional(),
  baseStats: z.object({
    speed: z.number().int().min(0),
    stability: z.number().int().min(0),
    armor: z.number().int().min(0),
    maxHealth: z.number().int().positive(),
  }),
  basePorts: z.object({
    maxFirmware: z.number().int().min(0),
    maxAugment: z.number().int().min(0),
    maxSoftware: z.number().int().min(0),
  }),
  upgrades: z.array(z.unknown()).default([]),
  starterLoadout: z.array(z.string()).optional(),
});
