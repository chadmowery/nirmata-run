import fs from 'fs/promises';
import path from 'path';

const sessionId = 'test-session-uninstall';
const PROFILES_DIR = path.join(process.cwd(), 'data', 'profiles');
const filePath = path.join(PROFILES_DIR, `${sessionId}.json`);

async function verifyUninstallPersistence() {
  console.log('--- Verifying Uninstall Persistence ---');
  
  // 1. Setup a profile with an installed item
  const initialProfile = {
    sessionId,
    wallet: { scrap: 100, flux: 10 },
    blueprintLibrary: [],
    installedItems: [
      {
        blueprintId: 'firewall-v1',
        type: 'software',
        shellId: 'basic-shell',
        isLegacy: false,
      }
    ],
    shellUpgrades: {},
    vault: [],
    overflow: [],
    attemptTracking: { weekNumber: 1, weeklyAttemptUsed: false, dayNumber: 1, dailyAttemptUsed: false },
    weekSeed: 12345,
    createdAt: Date.now(),
  };

  await fs.mkdir(PROFILES_DIR, { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(initialProfile, null, 2));
  console.log('Setup: Created test profile with 1 installed item');

  // 2. Simulate Uninstall API Logic
  const profile = JSON.parse(await fs.readFile(filePath, 'utf-8'));
  const index = profile.installedItems.findIndex(i => i.blueprintId === 'firewall-v1' && i.shellId === 'basic-shell');
  
  const item = profile.installedItems[index];
  const restoredItem = {
    entityId: Date.now(),
    templateId: item.blueprintId,
    rarityTier: 'common',
    itemType: item.type,
    extractedAtFloor: 0,
    extractedAtTimestamp: Date.now(),
  };

  profile.installedItems.splice(index, 1);
  profile.vault.push(restoredItem);
  
  await fs.writeFile(filePath, JSON.stringify(profile, null, 2));
  console.log('Simulated: Uninstalled firewall-v1');

  // 3. Verify on disk
  const saved = JSON.parse(await fs.readFile(filePath, 'utf-8'));
  if (saved.installedItems.length === 0 && saved.vault.length === 1 && saved.vault[0].templateId === 'firewall-v1') {
    console.log('SUCCESS: Item moved from installedItems to vault on disk.');
  } else {
    console.error('FAILURE: Item not correctly moved.');
    console.error('Profile on disk:', JSON.stringify(saved, null, 2));
    process.exit(1);
  }

  process.exit(0);
}

verifyUninstallPersistence().catch(err => {
  console.error(err);
  process.exit(1);
});
