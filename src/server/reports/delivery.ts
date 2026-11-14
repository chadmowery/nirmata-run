/**
 * Shared delivery service for manual and crash issue reports.
 * Handles dry-run index isolation (H-4), per-fingerprint concurrency locking (H-7),
 * error classification & outbox fallback (L-5), and thin route delegation (L-12).
 */

import type { ReportsStatus, ReportResult } from '@shared/reports/schemas';
import { logger } from '@engine/utils/logger';
import type { ReportsServerConfig } from './config';
import {
  composeIssueBody,
  composeDedupeComment,
  type IssueComposeParams,
} from './composer';
import { writeDryRunReport } from './dry-run';
import {
  getGitHubClient,
  GitHubApiError,
  GitHubAuthError,
  GitHubRateLimitError,
  GitHubNetworkError,
} from './github-client';
import { fingerprintIndex, dryRunFingerprintIndex } from './fingerprint-index';
import { getReportOutbox, type OutboxActionType } from './outbox';
import type { FingerprintIndexInterface, OutboxInterface } from './interfaces';

export interface DeliveryOutcome {
  statusCode: number;
  payload: ReportResult | { error: string };
}

export interface DeliverManualParams {
  cfg: ReportsServerConfig;
  status: ReportsStatus;
  ref: string;
  title: string;
  body: string;
  labels: string[];
  dryRunMetadata?: Record<string, unknown>;
}

export interface DeliverCrashParams {
  cfg: ReportsServerConfig;
  status: ReportsStatus;
  ref: string;
  fingerprint: string;
  title: string;
  labels: string[];
  composeParams: IssueComposeParams;
  dedupeContext: {
    build?: string;
    floor?: number;
    turn?: number;
    sessionId?: string;
    note?: string;
  };
}

const gLockKey = Symbol.for('nirmata.reportsFingerprintLocks');
const gIdempotencyKey = Symbol.for('nirmata.reportsManualIdempotency');
const gLockObj = globalThis as unknown as {
  [gLockKey]?: Map<string, Promise<void>>;
  [gIdempotencyKey]?: Map<string, { expiresAt: number; promise: Promise<DeliveryOutcome> }>;
};

const MANUAL_IDEMPOTENCY_TTL_MS = 5 * 60 * 1000; // 5 minutes

function getIdempotencyCache(): Map<string, { expiresAt: number; promise: Promise<DeliveryOutcome> }> {
  if (!gLockObj[gIdempotencyKey]) {
    gLockObj[gIdempotencyKey] = new Map();
  }
  return gLockObj[gIdempotencyKey];
}

function pruneExpiredIdempotency(now = Date.now()): void {
  const cache = getIdempotencyCache();
  for (const [k, entry] of cache.entries()) {
    if (entry.expiresAt <= now) {
      cache.delete(k);
    }
  }
}

/**
 * Looks up an active (in-flight or cached within TTL) outcome for a manual report idempotency key.
 */
export function getIdempotentManualOutcome(idempotencyKey?: string): Promise<DeliveryOutcome> | undefined {
  if (!idempotencyKey) return undefined;
  const now = Date.now();
  pruneExpiredIdempotency(now);
  return getIdempotencyCache().get(idempotencyKey)?.promise;
}

/**
 * Executes a manual report delivery under a short-TTL idempotency cache so double-submits return the first outcome.
 */
export function runWithManualIdempotency(
  idempotencyKey: string | undefined,
  fn: () => Promise<DeliveryOutcome>
): Promise<DeliveryOutcome> {
  if (!idempotencyKey) {
    return fn();
  }
  const existing = getIdempotentManualOutcome(idempotencyKey);
  if (existing) {
    return existing;
  }

  const cache = getIdempotencyCache();
  const promise = fn().then(
    (outcome) => {
      if (outcome.statusCode !== 200) {
        cache.delete(idempotencyKey);
      }
      return outcome;
    },
    (err) => {
      cache.delete(idempotencyKey);
      throw err;
    }
  );
  cache.set(idempotencyKey, {
    expiresAt: Date.now() + MANUAL_IDEMPOTENCY_TTL_MS,
    promise,
  });
  return promise;
}

function getFingerprintLocks(): Map<string, Promise<void>> {
  if (!gLockObj[gLockKey]) {
    gLockObj[gLockKey] = new Map<string, Promise<void>>();
  }
  return gLockObj[gLockKey];
}

/**
 * Serializes concurrent crash deliveries sharing the same fingerprint so duplicate
 * GitHub issues are not created before fingerprintIndex updates.
 */
async function withFingerprintLock<T>(fingerprint: string, fn: () => Promise<T>): Promise<T> {
  const locks = getFingerprintLocks();
  const prev = locks.get(fingerprint) ?? Promise.resolve();
  let release!: () => void;
  const next = new Promise<void>((resolve) => {
    release = resolve;
  });
  const chain = prev.then(
    () => next,
    () => next
  );
  locks.set(fingerprint, chain);

  try {
    await prev.catch(() => {});
    return await fn();
  } finally {
    release();
    if (locks.get(fingerprint) === chain) {
      locks.delete(fingerprint);
    }
  }
}

function isPermanentGitHubClientError(err: unknown): err is GitHubApiError {
  return (
    err instanceof GitHubApiError &&
    !(err instanceof GitHubAuthError) &&
    !(err instanceof GitHubRateLimitError) &&
    err.status >= 400 &&
    err.status < 500
  );
}

function classifyFailureReason(err: unknown): string {
  if (err instanceof GitHubAuthError) return 'auth';
  if (err instanceof GitHubRateLimitError) return 'rate-limit';
  if (err instanceof GitHubNetworkError) return 'network';
  return 'transient';
}

function enqueueOrRejectOnFailure(
  err: unknown,
  item: {
    ref: string;
    action: OutboxActionType;
    title?: string;
    body: string;
    labels?: string[];
    issueNumber?: number;
    fingerprint?: string;
  }
): DeliveryOutcome {
  if (isPermanentGitHubClientError(err)) {
    logger.error(`Permanent GitHub error for ${item.ref}; not queuing`, 'REPORTS', {
      status: err.status,
      err: String(err),
    });
    return {
      statusCode: 502,
      payload: { error: 'Unable to submit report to upstream tracker' },
    };
  }

  const reason = classifyFailureReason(err);
  logger.warn(`GitHub delivery failed (${reason}) for ${item.ref}; queuing in outbox`, 'REPORTS', {
    err: String(err),
  });

  const outbox: OutboxInterface = getReportOutbox();
  const queuedItem = outbox.enqueue(item);
  return {
    statusCode: 200,
    payload: { status: 'queued', ref: queuedItem.ref },
  };
}

/**
 * Delivers a manual issue report (bug/feature/feedback) in dry-run or live mode.
 */
export async function deliverManualReport(params: DeliverManualParams): Promise<DeliveryOutcome> {
  const { cfg, status, ref, title, body, labels, dryRunMetadata } = params;

  if (status.mode === 'dry-run') {
    const res = writeDryRunReport({
      ref,
      type: 'issue',
      title,
      body,
      labels,
      metadata: dryRunMetadata,
    });
    return { statusCode: 200, payload: res };
  }

  const client = getGitHubClient({
    token: cfg.githubToken,
    repo: cfg.githubRepo,
  });

  try {
    await client.ensureLabels(labels);
    await client.createIssue({ title, body, labels });
    return { statusCode: 200, payload: { status: 'created', ref } };
  } catch (err) {
    return enqueueOrRejectOnFailure(err, {
      ref,
      action: 'create-issue',
      title,
      body,
      labels,
    });
  }
}

/**
 * Delivers a crash report with serialized fingerprint deduplication, isolated dry-run indexing,
 * closed/404 Previously: #N linking, and outbox fallback.
 */
export async function deliverCrashReport(params: DeliverCrashParams): Promise<DeliveryOutcome> {
  const { cfg, status, ref, fingerprint, title, labels, composeParams, dedupeContext } = params;
  const activeIndex: FingerprintIndexInterface =
    status.mode === 'dry-run' ? dryRunFingerprintIndex : fingerprintIndex;

  return withFingerprintLock(fingerprint, async (): Promise<DeliveryOutcome> => {
    let existingEntry = activeIndex.get(fingerprint);
    let previousIssueNumber: number | undefined;

    const client = getGitHubClient({
      token: cfg.githubToken,
      repo: cfg.githubRepo,
    });

    // Fallback search if local index missed and running live
    if (!existingEntry && status.mode === 'live') {
      try {
        const searchedIssue = await client.searchIssueByFingerprint(fingerprint);
        if (searchedIssue) {
          // Hydrate with lastCommentAt=0 so the first post-restart occurrence can comment immediately (NL-2)
          activeIndex.recordNewIssue(fingerprint, searchedIssue, Date.now(), { lastCommentAt: 0 });
          existingEntry = activeIndex.get(fingerprint);
        }
      } catch {
        // Non-fatal search failure
      }
    }

    // Deduplication handling when an existing issue is tracked
    if (existingEntry) {
      let isOpen = true;
      if (status.mode === 'live') {
        try {
          const issueState = await client.getIssue(existingEntry.issueNumber);
          isOpen = issueState.state === 'open';
          if (!isOpen) {
            previousIssueNumber = existingEntry.issueNumber;
          }
        } catch (err) {
          if (err instanceof GitHubApiError && err.status === 404) {
            isOpen = false;
            previousIssueNumber = existingEntry.issueNumber;
          } else {
            isOpen = true;
          }
        }
      }

      if (isOpen) {
        const occurrence = activeIndex.recordOccurrence(fingerprint);
        const count = occurrence ? occurrence.count : existingEntry.count + 1;
        const canComment = occurrence ? occurrence.canComment : true;

        if (canComment) {
          const commentBody = composeDedupeComment({
            ref,
            count,
            build: dedupeContext.build,
            floor: dedupeContext.floor,
            turn: dedupeContext.turn,
            sessionId: dedupeContext.sessionId,
            note: dedupeContext.note,
          });

          if (status.mode === 'dry-run') {
            const res = writeDryRunReport({
              ref,
              type: 'comment',
              body: commentBody,
              issueNumber: existingEntry.issueNumber,
            });
            return { statusCode: 200, payload: res };
          }

          try {
            await client.addComment(existingEntry.issueNumber, commentBody);
            return { statusCode: 200, payload: { status: 'commented', ref } };
          } catch (err) {
            return enqueueOrRejectOnFailure(err, {
              ref,
              action: 'add-comment',
              issueNumber: existingEntry.issueNumber,
              body: commentBody,
            });
          }
        }

        // Throttled within 10-minute comment cooldown
        return { statusCode: 200, payload: { status: 'commented', ref } };
      }
    }

    // Create a new crash issue (with optional Previously: #N link)
    const body = composeIssueBody({
      ...composeParams,
      previousIssueNumber,
    });

    if (status.mode === 'dry-run') {
      // Isolated in-memory dry-run index only; persistent fingerprintIndex stays clean
      activeIndex.recordNewIssue(fingerprint, 99999);
      const res = writeDryRunReport({
        ref,
        type: 'issue',
        title,
        body,
        labels,
      });
      return { statusCode: 200, payload: res };
    }

    try {
      await client.ensureLabels(labels);
      const created = await client.createIssue({ title, body, labels });
      activeIndex.recordNewIssue(fingerprint, created.number);
      return { statusCode: 200, payload: { status: 'created', ref } };
    } catch (err) {
      return enqueueOrRejectOnFailure(err, {
        ref,
        action: 'create-issue',
        title,
        body,
        labels,
        fingerprint,
      });
    }
  });
}
