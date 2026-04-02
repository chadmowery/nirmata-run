import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadProfile, saveProfile, createDefaultProfile } from '../profile-persistence';
import fs from 'fs/promises';
import path from 'path';

describe('Profile Persistence', () => {
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
    
    await saveProfile(profile);
    
    const loaded = await loadProfile(sessionId);
    expect(loaded).not.toBeNull();
    expect(loaded?.wallet.scrap).toBe(500);
    expect(loaded?.sessionId).toBe(sessionId);
  });

  it('returns null if profile does not exist', async () => {
    const loaded = await loadProfile('non-existent');
    expect(loaded).toBeNull();
  });
});
