import fs from 'fs/promises';
import path from 'path';
import { z } from 'zod';

const BlueprintEntrySchema = z.object({
  blueprintId: z.string(),
  type: z.enum(['firmware', 'augment']),
  compiledAt: z.number(),
});

const ShellUpgradesSchema = z.object({
  speed: z.number().int().min(0).default(0),
  armor: z.number().int().min(0).default(0),
  stability: z.number().int().min(0).default(0),
  additionalPorts: z.number().int().min(0).default(0),
});

const InstalledItemSchema = z.object({
  blueprintId: z.string(),
  type: z.enum(['firmware', 'augment']),
  shellId: z.string(),
  isLegacy: z.boolean().default(false),
});

const VaultItemSchema = z.object({
  entityId: z.number(),
  templateId: z.string(),
  rarityTier: z.string(),
  itemType: z.enum(['firmware', 'augment', 'software']),
  extractedAtFloor: z.number(),
  extractedAtTimestamp: z.number(),
});

const AttemptTrackingSchema = z.object({
  weekNumber: z.number().default(0),
  weeklyAttemptUsed: z.boolean().default(false),
  dayNumber: z.number().default(0),
  dailyAttemptUsed: z.boolean().default(false),
}).default({});

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

const PROFILES_DIR = path.join(process.cwd(), 'data', 'profiles');

export function createDefaultProfile(sessionId: string): PlayerProfile {
  return PlayerProfileSchema.parse({ sessionId });
}

export async function loadProfile(sessionId: string): Promise<PlayerProfile | null> {
  const filePath = path.join(PROFILES_DIR, `${sessionId}.json`);
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    return PlayerProfileSchema.parse(JSON.parse(raw));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

export async function saveProfile(profile: PlayerProfile): Promise<void> {
  await fs.mkdir(PROFILES_DIR, { recursive: true });
  const filePath = path.join(PROFILES_DIR, `${profile.sessionId}.json`);
  const tempPath = `${filePath}.tmp`;
  await fs.writeFile(tempPath, JSON.stringify(profile, null, 2), 'utf-8');
  await fs.rename(tempPath, filePath);
}
