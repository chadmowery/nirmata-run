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
  GitHubAuthError,
  GitHubRateLimitError,
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
    const fullItem: OutboxItem = {
      ...item,
      attempts: 0,
      nextAttemptAt: 0, // Immediately eligible for processing
      createdAt: now,
    };

    this.saveItem(fullItem);
    logger.info('REPORTS', `Enqueued report ${item.ref} to outbox`, { action: item.action });
    return fullItem;
  }

  saveItem(item: OutboxItem): void {
    this.ensureDirs();
    const targetPath = this.getItemPath(item.ref);
    const tempPath = `${targetPath}.${crypto.randomUUID()}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(item, null, 2), 'utf-8');
    fs.renameSync(tempPath, targetPath);
  }

  deleteItem(ref: string): void {
    const targetPath = this.getItemPath(ref);
    if (fs.existsSync(targetPath)) {
      try {
        fs.unlinkSync(targetPath);
      } catch (err) {
        logger.warn('REPORTS', `Could not delete outbox file ${targetPath}`, { err: String(err) });
      }
    }
  }

  moveToFailed(item: OutboxItem): void {
    this.ensureDirs();
    this.deleteItem(item.ref);
    const failedPath = this.getFailedPath(item.ref);
    fs.writeFileSync(failedPath, JSON.stringify(item, null, 2), 'utf-8');
    logger.error('REPORTS', `Report ${item.ref} exceeded max retries and moved to failed/`, {
      attempts: item.attempts,
      lastError: item.lastError,
    });
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
      logger.error('REPORTS', 'Failed to list outbox items', { err: String(err) });
    }
    return items;
  }

  private getClient(): GitHubClient {
    if (this.githubClient) return this.githubClient;
    const cfg = getReportsServerConfig();
    return new GitHubClient({
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
          const res = await client.createIssue({
            title: item.title || '[Bug] Report',
            body: item.body,
            labels: item.labels || ['ai-ready', 'source:in-game'],
          });
          if (item.fingerprint) {
            fingerprintIndex.recordNewIssue(item.fingerprint, res.number);
          }
        } else if (item.action === 'add-comment' && item.issueNumber) {
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
          logger.error('REPORTS', 'CRITICAL: GitHub credentials rejected; outbox worker paused (blocked-auth)', {
            err: String(err),
          });
          this.saveItem(item);
          break; // Stop further processing until credentials update
        }

        let delayMs = BACKOFF_SCHEDULE_MS[Math.min(item.attempts - 1, BACKOFF_SCHEDULE_MS.length - 1)];
        if (err instanceof GitHubRateLimitError && err.retryAfterSeconds > 0) {
          delayMs = Math.max(delayMs, err.retryAfterSeconds * 1000);
        }

        item.nextAttemptAt = now + delayMs;

        if (item.attempts >= MAX_ATTEMPTS) {
          this.moveToFailed(item);
        } else {
          this.saveItem(item);
        }
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

export const reportOutbox: ReportOutbox =
  globalObj[globalKey] || (globalObj[globalKey] = new ReportOutbox());
