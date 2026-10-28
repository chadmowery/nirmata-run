import economyRaw from './entities/templates/economy.json';
import { EconomyConfig } from '@shared/economy-types';

const economy = economyRaw as unknown as EconomyConfig;

export interface ScoreStats {
  floorNumber: number;
  scrapExtracted: number;
  softwareExtracted: number;
  fluxExtracted: number;
}

/**
 * Calculates score based on run stats.
 * D-21: Authoritative score calculation based on economy config.
 */
export function calculateScore(stats: ScoreStats): number {
  const { scoring } = economy;
  return (
    stats.floorNumber * scoring.floorReached +
    stats.scrapExtracted * scoring.scrapCollected +
    stats.softwareExtracted * scoring.softwareExtracted +
    stats.fluxExtracted * scoring.fluxExtracted
  );
}
