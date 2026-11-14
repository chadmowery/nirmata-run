/**
 * In-memory DraftStore for sealed crash reports.
 * Binds draft IDs to player sessions with a 30-minute TTL and max 50 entries.
 */

import crypto from 'crypto';
import type { RedactedCrashPreview } from '@/shared/reports/schemas';

export interface ServerCrashDraft {
  draftId: string;
  sessionId: string;
  createdAt: number;
  source: 'SERVER_TURN' | 'SERVER_5XX';
  fingerprint: string;
  preview: RedactedCrashPreview;
  sealed: {
    errorName: string;
    errorMessage: string;
    stack?: string;
    runSeed?: number | string;
    action?: unknown;
    phase?: string;
    mode?: string;
    floor?: number;
    turn?: number;
    isPaused?: boolean;
    sectorCondition?: string;
    timestamp?: string;
    playerComponents?: Record<string, unknown>;
    livingEnemiesCount?: number;
    livingEnemies?: Array<{ id: number; name?: string; hp?: number }>;
  };
}

export class DraftStore {
  private drafts: Map<string, ServerCrashDraft> = new Map();
  private readonly ttlMs = 30 * 60 * 1000; // 30 minutes
  private readonly maxEntries = 50;

  constructor() {}

  private pruneExpired(now = Date.now()): void {
    for (const [id, draft] of this.drafts.entries()) {
      if (now - draft.createdAt > this.ttlMs) {
        this.drafts.delete(id);
      }
    }
  }

  /**
   * Stores a new sealed crash draft.
   */
  save(
    data: Omit<ServerCrashDraft, 'draftId' | 'createdAt' | 'source'> & {
      draftId?: string;
      source?: 'SERVER_TURN' | 'SERVER_5XX';
    },
    now = Date.now()
  ): ServerCrashDraft {
    this.pruneExpired(now);

    // Evict oldest if at max capacity
    if (this.drafts.size >= this.maxEntries) {
      let oldestId: string | null = null;
      let oldestTime = Infinity;
      for (const [id, d] of this.drafts.entries()) {
        if (d.createdAt < oldestTime) {
          oldestTime = d.createdAt;
          oldestId = id;
        }
      }
      if (oldestId) {
        this.drafts.delete(oldestId);
      }
    }

    const draftId = data.draftId || crypto.randomUUID();
    const draft: ServerCrashDraft = {
      ...data,
      source: data.source || 'SERVER_TURN',
      draftId,
      createdAt: now,
    };

    this.drafts.set(draftId, draft);
    return draft;
  }

  /**
   * Redeems and consumes a draft.
   * Single-use only: verifies session ID matches, deletes draft from store, and returns it.
   */
  redeem(draftId: string, sessionId: string, now = Date.now()): ServerCrashDraft | null {
    this.pruneExpired(now);
    const draft = this.drafts.get(draftId);
    if (!draft) return null;

    if (draft.sessionId !== sessionId) {
      return null;
    }

    // Single-use: remove immediately
    this.drafts.delete(draftId);
    return draft;
  }

  get(draftId: string): ServerCrashDraft | undefined {
    return this.drafts.get(draftId);
  }

  clear(): void {
    this.drafts.clear();
  }
}

// Global process-wide singleton
const globalKey = Symbol.for('nirmata.draftStore');
const globalObj = globalThis as unknown as { [key: symbol]: DraftStore };

export const draftStore: DraftStore =
  globalObj[globalKey] || (globalObj[globalKey] = new DraftStore());
