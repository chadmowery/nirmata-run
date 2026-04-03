import fs from 'fs/promises';
import path from 'path';
import { PlayerProfile, PlayerProfileSchema, ProfileRepository } from '@/shared/profile';

const PROFILES_DIR = path.join(process.cwd(), 'data', 'profiles');

export class FSProfileRepository implements ProfileRepository {
  /**
   * Loads a player profile from the filesystem.
   */
  async load(sessionId: string): Promise<PlayerProfile | null> {
    const filePath = path.join(PROFILES_DIR, `${sessionId}.json`);
    try {
      const raw = await fs.readFile(filePath, 'utf-8');
      return PlayerProfileSchema.parse(JSON.parse(raw));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw error;
    }
  }

  /**
   * Saves a player profile to the filesystem.
   */
  async save(profile: PlayerProfile): Promise<void> {
    await fs.mkdir(PROFILES_DIR, { recursive: true });
    const filePath = path.join(PROFILES_DIR, `${profile.sessionId}.json`);
    const tempPath = `${filePath}.tmp`;
    
    await fs.writeFile(tempPath, JSON.stringify(profile, null, 2), 'utf-8');
    await fs.rename(tempPath, filePath);
  }
}

// Export a singleton instance for static use on the server if needed
export const profileRepository = new FSProfileRepository();
