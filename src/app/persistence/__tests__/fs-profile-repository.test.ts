import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { profileRepository } from '../fs-profile-repository';
import { createDefaultProfile } from '@shared/profile';
import fs from 'fs/promises';
import path from 'path';

describe('FSProfileRepository', () => {
  const sessionId = 'test-persistence-session';
  const profilesDir = path.join(process.cwd(), 'data', 'profiles');
  const filePath = path.join(profilesDir, `${sessionId}.json`);

  beforeEach(async () => {
    try {
      await fs.unlink(filePath);
    } catch (e) {}
  });

  afterEach(async () => {
    try {
      await fs.unlink(filePath);
    } catch (e) {}
  });

  it('saves and loads a profile', async () => {
    const profile = createDefaultProfile(sessionId);
    profile.wallet.scrap = 500;
    
    await profileRepository.save(profile);
    
    const loaded = await profileRepository.load(sessionId);
    expect(loaded).not.toBeNull();
    expect(loaded?.wallet.scrap).toBe(500);
    expect(loaded?.sessionId).toBe(sessionId);
  });

  it('returns null if profile does not exist', async () => {
    const loaded = await profileRepository.load('non-existent');
    expect(loaded).toBeNull();
  });
});
