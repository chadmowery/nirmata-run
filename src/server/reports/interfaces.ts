/**
 * Storage and state-backend interfaces for server-side issue reporting (Spec §13).
 * Isolating these contracts allows swapping local memory/disk adapters for shared
 * Redis/Firestore stores before deploying on ephemeral or multi-instance hosts.
 */

import type { RedactedCrashPreview } from '@shared/reports/schemas';
import type { ReportRateCategory, RateLimitResult } from './rate-limiter';
import type { ServerCrashDraft } from './draft-store';
import type { FingerprintIndexEntry } from './fingerprint-index';
import type { OutboxActionType, OutboxItem, OutboxWorkerState } from './outbox';

export interface RateLimiter {
  consume(category: ReportRateCategory, now?: number): RateLimitResult;
  reset(): void;
}

export interface DraftStoreInterface {
  save(
    data: {
      draftId?: string;
      sessionId: string;
      source?: 'SERVER_TURN' | 'SERVER_5XX';
      fingerprint: string;
      preview: RedactedCrashPreview;
      sealed: ServerCrashDraft['sealed'];
    },
    now?: number
  ): ServerCrashDraft;
  redeem(draftId: string, sessionId: string, now?: number): ServerCrashDraft | null;
  get(draftId: string): ServerCrashDraft | undefined;
  clear(): void;
}

export interface FingerprintIndexInterface {
  get(fingerprint: string): FingerprintIndexEntry | undefined;
  recordNewIssue(
    fingerprint: string,
    issueNumber: number,
    now?: number,
    options?: { lastCommentAt?: number }
  ): void;
  recordOccurrence(
    fingerprint: string,
    now?: number
  ): { canComment: boolean; count: number; issueNumber: number } | null;
  clear(): void;
}

export interface OutboxInterface {
  hasRef(ref: string): boolean;
  getState(): OutboxWorkerState;
  enqueue(
    item: {
      ref: string;
      action: OutboxActionType;
      title?: string;
      body: string;
      labels?: string[];
      issueNumber?: number;
      fingerprint?: string;
    },
    now?: number
  ): OutboxItem;
  listPending(): OutboxItem[];
  processOutboxOnce(now?: number): Promise<{ processed: number; success: number; failed: number }>;
  startWorker(intervalMs?: number): void;
  stopWorker(): void;
}
