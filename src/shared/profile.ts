import { z } from 'zod';

export const BlueprintEntrySchema = z.object({
  blueprintId: z.string(),
  type: z.enum(['firmware', 'augment']),
  compiledAt: z.number(),
});

export const ShellUpgradesSchema = z.object({
  speed: z.number().int().min(0).default(0),
  armor: z.number().int().min(0).default(0),
  stability: z.number().int().min(0).default(0),
  additionalPorts: z.number().int().min(0).default(0),
});

export const InstalledItemSchema = z.object({
  blueprintId: z.string(),
  type: z.enum(['firmware', 'augment']),
  shellId: z.string(),
  isLegacy: z.boolean().default(false),
});

export const VaultItemSchema = z.object({
  entityId: z.number(),
  templateId: z.string(),
  rarityTier: z.string(),
  itemType: z.enum(['firmware', 'augment', 'software']),
  extractedAtFloor: z.number(),
  extractedAtTimestamp: z.number(),
});

export const AttemptTrackingSchema = z.object({
  weekNumber: z.number().default(0),
  weeklyAttemptUsed: z.boolean().default(false),
  dayNumber: z.number().default(0),
  dailyAttemptUsed: z.boolean().default(false),
}).default({
  weekNumber: 0,
  weeklyAttemptUsed: false,
  dayNumber: 0,
  dailyAttemptUsed: false
});

export const PlayerProfileSchema = z.object({
  sessionId: z.string(),
  wallet: z.object({
    scrap: z.number().int().min(0).default(0),
    flux: z.number().int().min(0).default(0),
  }).default({ scrap: 0, flux: 0 }),
  blueprintLibrary: z.array(BlueprintEntrySchema).default([]),
  installedItems: z.array(InstalledItemSchema).default([]),
  shellUpgrades: z.record(z.string(), ShellUpgradesSchema).default({}),
  vault: z.array(VaultItemSchema).default([]),
  overflow: z.array(VaultItemSchema).default([]),
  attemptTracking: AttemptTrackingSchema,
  weekSeed: z.number().default(0),
  createdAt: z.number().default(() => Date.now()),
});

export type PlayerProfile = z.infer<typeof PlayerProfileSchema>;
export type BlueprintEntry = z.infer<typeof BlueprintEntrySchema>;
export type InstalledItem = z.infer<typeof InstalledItemSchema>;
export type VaultItem = z.infer<typeof VaultItemSchema>;
export type AttemptTracking = z.infer<typeof AttemptTrackingSchema>;

/**
 * Data Abstraction Layer for player profiles.
 */
export interface ProfileRepository {
  load(sessionId: string): Promise<PlayerProfile | null>;
  save(profile: PlayerProfile): Promise<void>;
}

/**
 * Pure factory for creating a default profile.
 */
export function createDefaultProfile(sessionId: string): PlayerProfile {
  return PlayerProfileSchema.parse({ sessionId });
}
