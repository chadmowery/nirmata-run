import { describe, it, expect, beforeEach } from 'vitest';
import { PredictionDeduplicator } from '../prediction-dedup';

describe('PredictionDeduplicator', () => {
  let dedup: PredictionDeduplicator;

  beforeEach(() => {
    dedup = new PredictionDeduplicator(2000); // 2000ms TTL
  });

  it('records predicted tokens and consumes matching replay', () => {
    dedup.recordPredicted('ENTITY_MOVED', 'player:5,5->5,4', 1000);

    expect(dedup.size).toBe(1);

    // Matching event within TTL consumes token
    const consumed = dedup.consumeIfPredicted('ENTITY_MOVED', 'player:5,5->5,4', 1100);
    expect(consumed).toBe(true);

    // Token should now be gone, duplicate check returns false
    expect(dedup.size).toBe(0);
    expect(dedup.consumeIfPredicted('ENTITY_MOVED', 'player:5,5->5,4', 1200)).toBe(false);
  });

  it('rejects tokens that do not match eventType or payload', () => {
    dedup.recordPredicted('ENTITY_MOVED', 'player:5,5->5,4', 1000);

    expect(dedup.consumeIfPredicted('DAMAGE_DEALT', 'player:5,5->5,4', 1100)).toBe(false);
    expect(dedup.consumeIfPredicted('ENTITY_MOVED', 'player:5,5->6,5', 1100)).toBe(false);
  });

  it('rejects expired tokens beyond the TTL window', () => {
    dedup.recordPredicted('ENTITY_MOVED', 'player:5,5->5,4', 1000);

    // Past 2000ms TTL (1000 + 2001)
    const consumed = dedup.consumeIfPredicted('ENTITY_MOVED', 'player:5,5->5,4', 3001);
    expect(consumed).toBe(false);
    expect(dedup.size).toBe(0);
  });

  it('prunes expired entries during pruneExpired()', () => {
    dedup.recordPredicted('E1', 't1', 1000);
    dedup.recordPredicted('E2', 't2', 2000);

    dedup.pruneExpired(3500); // 1000 is expired (> 2000ms ago), 2000 is still active
    expect(dedup.size).toBe(1);
    expect(dedup.consumeIfPredicted('E2', 't2', 3500)).toBe(true);
  });

  it('clears all entries on clear()', () => {
    dedup.recordPredicted('E1', 't1', 1000);
    dedup.recordPredicted('E2', 't2', 1000);
    expect(dedup.size).toBe(2);

    dedup.clear();
    expect(dedup.size).toBe(0);
  });
});
