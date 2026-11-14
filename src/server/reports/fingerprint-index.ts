/**
 * Persistent fingerprint index for crash deduplication.
 * Stored in data/report-index.json with atomic writes.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { logger } from '@/engine/utils/logger';
import type { FingerprintIndexInterface } from './interfaces';

export interface FingerprintIndexEntry {
  issueNumber: number;
  count: number;
  lastCommentAt: number;
  updatedAt: number;
}

export class FingerprintIndex implements FingerprintIndexInterface {
  private readonly filePath: string | null;
  private entries: Map<string, FingerprintIndexEntry> = new Map();
  private loaded = false;
  private readonly commentThrottleMs = 10 * 60 * 1000; // 10 minutes

  constructor(filePath: string | null = path.join(process.cwd(), 'data', 'report-index.json')) {
    this.filePath = filePath;
  }

  private ensureLoaded(): void {
    if (this.loaded) return;
    this.loaded = true;
    if (!this.filePath) return;

    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        const data = JSON.parse(raw) as Record<string, FingerprintIndexEntry>;
        for (const [fp, entry] of Object.entries(data)) {
          this.entries.set(fp, entry);
        }
      }
    } catch (err) {
      logger.error(`Failed to load fingerprint index from ${this.filePath}`, 'REPORTS', {
        err: String(err),
      });
    }
  }

  private save(): void {
    if (!this.filePath) return;
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const obj: Record<string, FingerprintIndexEntry> = {};
      for (const [fp, entry] of this.entries.entries()) {
        obj[fp] = entry;
      }

      const tempPath = `${this.filePath}.${crypto.randomUUID()}.tmp`;
      fs.writeFileSync(tempPath, JSON.stringify(obj, null, 2), 'utf-8');
      fs.renameSync(tempPath, this.filePath);
    } catch (err) {
      logger.error(`Failed to save fingerprint index to ${this.filePath}`, 'REPORTS', {
        err: String(err),
      });
    }
  }

  get(fingerprint: string): FingerprintIndexEntry | undefined {
    this.ensureLoaded();
    return this.entries.get(fingerprint);
  }

  recordNewIssue(fingerprint: string, issueNumber: number, now = Date.now()): void {
    this.ensureLoaded();
    this.entries.set(fingerprint, {
      issueNumber,
      count: 1,
      lastCommentAt: now,
      updatedAt: now,
    });
    this.save();
  }

  /**
   * Records an occurrence of a known crash.
   * Increments occurrence count and decides whether to post a GitHub comment based on the 10-minute throttle.
   */
  recordOccurrence(
    fingerprint: string,
    now = Date.now()
  ): { canComment: boolean; count: number; issueNumber: number } | null {
    this.ensureLoaded();
    const existing = this.entries.get(fingerprint);
    if (!existing) return null;

    existing.count += 1;
    existing.updatedAt = now;

    const timeSinceLastComment = now - existing.lastCommentAt;
    let canComment = false;

    if (timeSinceLastComment >= this.commentThrottleMs) {
      existing.lastCommentAt = now;
      canComment = true;
    }

    this.save();
    return {
      canComment,
      count: existing.count,
      issueNumber: existing.issueNumber,
    };
  }

  clear(): void {
    this.entries.clear();
    this.loaded = true;
    if (this.filePath && fs.existsSync(this.filePath)) {
      try {
        fs.unlinkSync(this.filePath);
      } catch {
        // ignore
      }
    }
  }
}

// Global process-wide singletons
const globalKey = Symbol.for('nirmata.fingerprintIndex');
const dryRunGlobalKey = Symbol.for('nirmata.dryRunFingerprintIndex');
const globalObj = globalThis as unknown as { [key: symbol]: FingerprintIndex };

export const fingerprintIndex: FingerprintIndex =
  globalObj[globalKey] || (globalObj[globalKey] = new FingerprintIndex());

/**
 * Isolated in-memory fingerprint index for dry-run mode so fake issues never pollute data/report-index.json.
 */
export const dryRunFingerprintIndex: FingerprintIndex =
  globalObj[dryRunGlobalKey] || (globalObj[dryRunGlobalKey] = new FingerprintIndex(null));
