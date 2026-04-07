import { PlayerProfileSchema } from '../src/shared/profile.js';

const mockProfile = {
  sessionId: 'test-session',
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
  attemptTracking: {
    weekNumber: 1,
    weeklyAttemptUsed: false,
    dayNumber: 1,
    dailyAttemptUsed: false
  },
  weekSeed: 12345,
  createdAt: Date.now(),
};

try {
  PlayerProfileSchema.parse(mockProfile);
  console.log('SUCCESS: Profile with software item parsed correctly.');
} catch (error) {
  console.error('FAILURE: Profile parsing failed.');
  console.error(error);
  process.exit(1);
}
