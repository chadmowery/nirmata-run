/**
 * Disk-persisted report outbox and background retry worker.
 * Queues approved reports during network/rate-limit outages and retries with backoff.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { logger } from '@/engine/utils/logger';
import {
  GitHubClient,
  GitHubApiError,
  GitHubAuthError,
  GitHubRateLimitError,
  getGitHubClient,
} from './github-client';
import { fingerprintIndex } from './fingerprint-index';
import { getReportsServerConfig } from './config';

export type OutboxActionType = 'create-issue' | 'add-comment';

export interface OutboxItem {
  ref: string;
  action: OutboxActionType;
  title?: string;
  body: string;
  labels?: string[];
  issueNumber?: number;
  fingerprint?: string;
  attempts: number;
  nextAttemptAt: number;
  createdAt: number;
  lastError?: string;
}

export type OutboxWorkerState = 'idle' | 'running' | 'blocked-auth';

// Standard backoff schedule: 1m -> 2m -> 5m -> 15m -> 1h
const BACKOFF_SCHEDULE_MS = [
  60 * 1000,
  2 * 60 * 1000,
  5 * 60 * 1000,
  15 * 60 * 1000,
  60 * 60 * 1000,
];
const MAX_ATTEMPTS = 8;

export class ReportOutbox {
  private readonly outboxDir: string;
  private readonly failedDir: string;
  private state: OutboxWorkerState = 'idle';
  private timer: ReturnType<typeof setInterval> | null = null;
  private githubClient?: GitHubClient;

  constructor(baseDir?: string, githubClient?: GitHubClient) {
    const root = baseDir || path.join(process.cwd(), 'data', 'report-outbox');
    this.outboxDir = root;
    this.failedDir = path.join(root, 'failed');
    this.githubClient = githubClient;
    this.ensureDirs();
  }

  private ensureDirs(): void {
    if (!fs.existsSync(this.outboxDir)) {
      fs.mkdirSync(this.outboxDir, { recursive: true });
    }
    if (!fs.existsSync(this.failedDir)) {
      fs.mkdirSync(this.failedDir, { recursive: true });
    }
  }

  getState(): OutboxWorkerState {
    return this.state;
  }

  resetAuthState(): void {
    if (this.state === 'blocked-auth') {
      this.state = 'idle';
    }
  }

  private getItemPath(ref: string): string {
    return path.join(this.outboxDir, `${ref}.json`);
  }

  private getFailedPath(ref: string): string {
    return path.join(this.failedDir, `${ref}.json`);
  }

  hasRef(ref: string): boolean {
    return fs.existsSync(this.getItemPath(ref)) || fs.existsSync(this.getFailedPath(ref));
  }

  /**
   * Enqueues a report item to disk.
   */
  enqueue(item: {
    ref: string;
    action: OutboxActionType;
    title?: string;
    body: string;
    labels?: string[];
    issueNumber?: number;
    fingerprint?: string;
  }, now = Date.now()): OutboxItem {
    this.ensureDirs();
    let effectiveRef = item.ref;
    if (this.hasRef(effectiveRef)) {
      const suffix = crypto.randomBytes(2).toString('hex').toUpperCase();
      effectiveRef = `${item.ref}-${suffix}`;
      logger.warn(`Outbox ref collision for ${item.ref}; reassigned to ${effectiveRef}`, 'REPORTS');
    }
    const fullItem: OutboxItem = {
      ...item,
      ref: effectiveRef,
      attempts: 0,
      nextAttemptAt: 0, // Immediately eligible for processing
      createdAt: now,
    };

    this.saveItem(fullItem);
    this.startWorker();
    logger.info(`Enqueued report ${effectiveRef} to outbox`, 'REPORTS', { action: item.action });
    return fullItem;
  }

  saveItem(item: OutboxItem): boolean {
    const targetPath = this.getItemPath(item.ref);
    const tempPath = `${targetPath}.${crypto.randomUUID()}.tmp`;
    try {
      this.ensureDirs();
      fs.writeFileSync(tempPath, JSON.stringify(item, null, 2), 'utf-8');
      fs.renameSync(tempPath, targetPath);
      return true;
    } catch (err) {
      logger.error(`Failed to persist outbox item ${item.ref}`, 'REPORTS', { err: String(err) });
      try {
        if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
      } catch {
        // ignore cleanup failure
      }
      return false;
    }
  }

  deleteItem(ref: string): void {
    const targetPath = this.getItemPath(ref);
    if (fs.existsSync(targetPath)) {
      try {
        fs.unlinkSync(targetPath);
      } catch (err) {
        logger.warn(`Could not delete outbox file ${targetPath}`, 'REPORTS', { err: String(err) });
      }
    }
  }

  moveToFailed(item: OutboxItem): void {
    try {
      this.ensureDirs();
      this.deleteItem(item.ref);
      const failedPath = this.getFailedPath(item.ref);
      fs.writeFileSync(failedPath, JSON.stringify(item, null, 2), 'utf-8');
      logger.error(`Report ${item.ref} moved to failed/`, 'REPORTS', {
        attempts: item.attempts,
        lastError: item.lastError,
      });
    } catch (err) {
      logger.error(`Failed to move report ${item.ref} to failed/`, 'REPORTS', {
        err: String(err),
        attempts: item.attempts,
        lastError: item.lastError,
      });
    }
  }

  listPending(): OutboxItem[] {
    this.ensureDirs();
    const items: OutboxItem[] = [];
    try {
      const files = fs.readdirSync(this.outboxDir);
      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        const fullPath = path.join(this.outboxDir, file);
        try {
          const stat = fs.statSync(fullPath);
          if (stat.isFile()) {
            const raw = fs.readFileSync(fullPath, 'utf-8');
            items.push(JSON.parse(raw) as OutboxItem);
          }
        } catch {
          // ignore corrupted/unreadable
        }
      }
    } catch (err) {
      logger.error('Failed to list outbox items', 'REPORTS', { err: String(err) });
    }
    return items;
  }

  private getClient(): GitHubClient {
    if (this.githubClient) return this.githubClient;
    const cfg = getReportsServerConfig();
    return getGitHubClient({
      token: cfg.githubToken,
      repo: cfg.githubRepo,
    });
  }

  /**
   * Processes due items in the outbox once.
   */
  async processOutboxOnce(now = Date.now()): Promise<{ processed: number; success: number; failed: number }> {
    if (this.state === 'blocked-auth') {
      return { processed: 0, success: 0, failed: 0 };
    }

    const items = this.listPending().filter((i) => i.nextAttemptAt <= now);
    if (items.length === 0) {
      return { processed: 0, success: 0, failed: 0 };
    }

    this.state = 'running';
    let success = 0;
    let failed = 0;
    const client = this.getClient();

    for (const item of items) {
      try {
        if (item.action === 'create-issue') {
          const issueLabels = item.labels || ['ai-ready', 'source:in-game'];
          await client.ensureLabels(issueLabels);
          const res = await client.createIssue({
            title: item.title || '[Bug] Report',
            body: item.body,
            labels: issueLabels,
          });
          if (item.fingerprint) {
            fingerprintIndex.recordNewIssue(item.fingerprint, res.number);
          }
        } else if (item.action === 'add-comment') {
          if (!item.issueNumber) {
            failed++;
            item.attempts += 1;
            item.lastError = 'Invalid add-comment item: missing issueNumber';
            this.moveToFailed(item);
            continue;
          }
          await client.addComment(item.issueNumber, item.body);
        }

        this.deleteItem(item.ref);
        success++;
      } catch (err) {
        failed++;
        item.attempts += 1;
        item.lastError = String(err);

        if (err instanceof GitHubAuthError) {
          this.state = 'blocked-auth';
          logger.error('CRITICAL: GitHub credentials rejected; outbox worker paused (blocked-auth)', 'REPORTS', {
            err: String(err),
          });
          this.saveItem(item);
          break; // Stop further processing until credentials update
        }

        const isPermanent4xx =
          err instanceof GitHubApiError &&
          !(err instanceof GitHubRateLimitError) &&
          err.status >= 400 &&
          err.status < 500;

        if (isPermanent4xx || item.attempts >= MAX_ATTEMPTS) {
          this.moveToFailed(item);
          continue;
        }

        let delayMs = BACKOFF_SCHEDULE_MS[Math.min(item.attempts - 1, BACKOFF_SCHEDULE_MS.length - 1)];
        if (err instanceof GitHubRateLimitError && err.retryAfterSeconds > 0) {
          delayMs = Math.max(delayMs, err.retryAfterSeconds * 1000);
        }

        item.nextAttemptAt = now + delayMs;
        this.saveItem(item);
      }
    }

    if (this.state !== 'blocked-auth') {
      this.state = 'idle';
    }

    return { processed: items.length, success, failed };
  }

  startWorker(intervalMs = 60000): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      void this.processOutboxOnce();
    }, intervalMs);
    if (typeof this.timer.unref === 'function') {
      this.timer.unref();
    }
  }

  stopWorker(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}

// Global process-wide singleton
const globalKey = Symbol.for('nirmata.reportOutbox');
const globalObj = globalThis as unknown as { [key: symbol]: ReportOutbox };

/**
 * Returns the process-wide ReportOutbox singleton and idempotently starts its background worker.
 */
export function getReportOutbox(): ReportOutbox {
  if (!globalObj[globalKey]) {
    globalObj[globalKey] = new ReportOutbox();
  }
  globalObj[globalKey].startWorker();
  return globalObj[globalKey];
}

export const reportOutbox: ReportOutbox = getReportOutbox();
