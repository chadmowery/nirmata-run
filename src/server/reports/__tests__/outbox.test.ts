import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import path from 'path';
import fs from 'fs';
import { ReportOutbox, getReportOutbox } from '../outbox';
import {
  GitHubClient,
  GitHubApiError,
  GitHubAuthError,
  GitHubRateLimitError,
  GitHubNetworkError,
} from '../github-client';

describe('ReportOutbox', () => {
  const testDir = path.join(process.cwd(), 'data', 'test-outbox');
  let outbox: ReportOutbox;
  let mockClient: GitHubClient;

  beforeEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    mockClient = new GitHubClient({ repo: 'chadmowery/nirmata-run' });
    vi.spyOn(mockClient, 'ensureLabels').mockResolvedValue(undefined);
    outbox = new ReportOutbox(testDir, mockClient);
  });

  afterEach(() => {
    outbox.stopWorker();
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('enqueues items to disk and lists pending', () => {
    outbox.enqueue({
      ref: 'NR-TEST1',
      action: 'create-issue',
      title: '[Bug] Test',
      body: 'body',
      labels: ['ai-ready', 'bug'],
    });

    const pending = outbox.listPending();
    expect(pending.length).toBe(1);
    expect(pending[0].ref).toBe('NR-TEST1');
    expect(pending[0].attempts).toBe(0);
  });

  it('delivers item successfully and removes it from disk', async () => {
    vi.spyOn(mockClient, 'createIssue').mockResolvedValue({
      number: 55,
      html_url: 'http://example.com/55',
      labels: ['ai-ready'],
    });

    outbox.enqueue({
      ref: 'NR-SUCCESS',
      action: 'create-issue',
      title: '[Crash] Test',
      body: 'crash body',
    });

    const res = await outbox.processOutboxOnce();
    expect(res.processed).toBe(1);
    expect(res.success).toBe(1);
    expect(outbox.listPending().length).toBe(0);
  });

  it('retries with backoff on network failure', async () => {
    vi.spyOn(mockClient, 'createIssue').mockRejectedValue(
      new GitHubNetworkError('Network error')
    );

    const now = 1000000;
    outbox.enqueue({
      ref: 'NR-RETRY',
      action: 'create-issue',
      title: '[Crash] Test',
      body: 'crash body',
    });

    const res = await outbox.processOutboxOnce(now);
    expect(res.failed).toBe(1);

    const pending = outbox.listPending();
    expect(pending.length).toBe(1);
    expect(pending[0].attempts).toBe(1);
    // First backoff is 60,000ms
    expect(pending[0].nextAttemptAt).toBe(now + 60000);
  });

  it('honors rate limit retry-after seconds', async () => {
    vi.spyOn(mockClient, 'createIssue').mockRejectedValue(
      new GitHubRateLimitError('Rate limited', 429, 300)
    );

    const now = 2000000;
    outbox.enqueue({
      ref: 'NR-RATELIMIT',
      action: 'create-issue',
      title: '[Crash] Test',
      body: 'crash body',
    });

    await outbox.processOutboxOnce(now);

    const pending = outbox.listPending();
    expect(pending[0].nextAttemptAt).toBe(now + 300 * 1000);
  });

  it('enters blocked-auth state on 401/403 and halts processing', async () => {
    vi.spyOn(mockClient, 'createIssue').mockRejectedValue(
      new GitHubAuthError('Bad credentials', 401)
    );

    outbox.enqueue({
      ref: 'NR-AUTH1',
      action: 'create-issue',
      title: 'T1',
      body: 'B1',
    });
    outbox.enqueue({
      ref: 'NR-AUTH2',
      action: 'create-issue',
      title: 'T2',
      body: 'B2',
    });

    await outbox.processOutboxOnce();
    expect(outbox.getState()).toBe('blocked-auth');

    // Both files preserved
    const pending = outbox.listPending();
    expect(pending.length).toBe(2);

    // Further calls process nothing while in blocked-auth
    const blockedRes = await outbox.processOutboxOnce();
    expect(blockedRes.processed).toBe(0);
  });

  it('moves item to failed/ directory after max retries (8 attempts)', async () => {
    vi.spyOn(mockClient, 'createIssue').mockRejectedValue(
      new GitHubNetworkError('Permanent network down')
    );

    outbox.enqueue({
      ref: 'NR-MAX-RETRY',
      action: 'create-issue',
      title: 'T',
      body: 'B',
    });

    let simTime = 1000000;
    for (let i = 0; i < 8; i++) {
      await outbox.processOutboxOnce(simTime);
      simTime += 2 * 60 * 60 * 1000; // Fast-forward time past any backoff
    }

    expect(outbox.listPending().length).toBe(0);
    const failedPath = path.join(testDir, 'failed', 'NR-MAX-RETRY.json');
    expect(fs.existsSync(failedPath)).toBe(true);
  });

  it('starts background worker on enqueue and delivers without manual processOutboxOnce call (C-1)', async () => {
    vi.useFakeTimers();
    try {
      const createIssueSpy = vi.spyOn(mockClient, 'createIssue').mockResolvedValue({
        number: 77,
        html_url: 'http://example.com/77',
        labels: ['ai-ready'],
      });

      outbox.enqueue({
        ref: 'NR-AUTO-WORKER',
        action: 'create-issue',
        title: '[Bug] Auto worker test',
        body: 'body',
      });

      expect(outbox.listPending().length).toBe(1);

      // Advance past the 60s worker interval without calling processOutboxOnce manually
      await vi.advanceTimersByTimeAsync(60_000);

      expect(createIssueSpy).toHaveBeenCalledTimes(1);
      expect(outbox.listPending().length).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('returns idempotent globalThis-guarded singleton from getReportOutbox (C-1)', () => {
    const a = getReportOutbox();
    const b = getReportOutbox();
    expect(a).toBe(b);
  });

  it('detects ref collisions in pending/failed dirs and avoids overwriting on enqueue (L-1)', () => {
    const first = outbox.enqueue({
      ref: 'NR-DUP1',
      action: 'create-issue',
      body: 'first report',
    });
    expect(outbox.hasRef('NR-DUP1')).toBe(true);
    expect(first.ref).toBe('NR-DUP1');

    const second = outbox.enqueue({
      ref: 'NR-DUP1',
      action: 'create-issue',
      body: 'second report',
    });
    expect(second.ref).not.toBe('NR-DUP1');
    expect(second.ref.startsWith('NR-DUP1-')).toBe(true);
    expect(outbox.listPending().length).toBe(2);
  });

  it('moves add-comment without issueNumber and permanent 4xx errors directly to failed/, and handles saveItem disk failures gracefully (L-4)', async () => {
    outbox.enqueue({
      ref: 'NR-NOISSUE',
      action: 'add-comment',
      body: 'orphan comment',
    });

    vi.spyOn(mockClient, 'createIssue').mockRejectedValue(
      new GitHubApiError('Unprocessable Entity', 422, { message: 'Validation Failed' })
    );
    outbox.enqueue({
      ref: 'NR-PERM422',
      action: 'create-issue',
      title: '[Bug] Invalid',
      body: 'bad payload',
    });

    const res = await outbox.processOutboxOnce(Date.now());
    expect(res.success).toBe(0);
    expect(res.failed).toBe(2);
    expect(outbox.listPending().length).toBe(0);
    expect(fs.existsSync(path.join(testDir, 'failed', 'NR-NOISSUE.json'))).toBe(true);
    expect(fs.existsSync(path.join(testDir, 'failed', 'NR-PERM422.json'))).toBe(true);

    // Simulate disk write failure during enqueue: should not throw
    const writeSpy = vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {
      throw new Error('ENOSPC: no space left on device');
    });
    try {
      expect(() =>
        outbox.enqueue({
          ref: 'NR-ENOSPC',
          action: 'create-issue',
          title: '[Bug] Full disk',
          body: 'body',
        })
      ).not.toThrow();
    } finally {
      writeSpy.mockRestore();
    }
  });
});
