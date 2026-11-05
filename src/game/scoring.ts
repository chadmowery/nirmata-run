import economyRaw from './entities/templates/economy.json';
import { EconomyConfig } from '@shared/economy-types';

const economy = economyRaw as unknown as EconomyConfig;

export interface ScoreStats {
  floorNumber: number;
  scrapExtracted: number;
  softwareExtracted: number;
  fluxExtracted: number;
  vaultsBreached?: number;
  trapsDisarmed?: number;
}

/**
 * Calculates score based on run stats.
 * D-21: Authoritative score calculation based on economy config.
 * Extended with environmental scoring bonuses:
 * - vaultsBreached: +150 per breached SecurityLock
 * - trapsDisarmed: +50 per disarmed/survived CorruptedNode
 */
export function calculateScore(stats: ScoreStats): number {
  const { scoring } = economy;
  return (
    stats.floorNumber * scoring.floorReached +
    stats.scrapExtracted * scoring.scrapCollected +
    stats.softwareExtracted * scoring.softwareExtracted +
    stats.fluxExtracted * scoring.fluxExtracted +
    (stats.vaultsBreached ?? 0) * (scoring.vaultsBreached ?? 150) +
    (stats.trapsDisarmed ?? 0) * (scoring.trapsDisarmed ?? 50)
  );
}
