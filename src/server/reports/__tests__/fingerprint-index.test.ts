import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { FingerprintIndex } from '../fingerprint-index';

describe('FingerprintIndex', () => {
  let testDir: string;
  let testFile: string;
  let index: FingerprintIndex;

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nr-fp-index-'));
    testFile = path.join(testDir, 'test-report-index.json');
    index = new FingerprintIndex(testFile);
  });

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  it('records new issue and saves to disk', () => {
    index.recordNewIssue('fp_1111222233334444', 42);
    const entry = index.get('fp_1111222233334444');

    expect(entry).toBeDefined();
    expect(entry?.issueNumber).toBe(42);
    expect(entry?.count).toBe(1);

    // Verify it persists on disk
    const reloaded = new FingerprintIndex(testFile);
    expect(reloaded.get('fp_1111222233334444')?.issueNumber).toBe(42);
  });

  it('throttles comments to at most 1 comment per 10 minutes', () => {
    const now = 10000000;
    const tenMin = 10 * 60 * 1000;

    index.recordNewIssue('fp_throttle', 100, now);

    // Immediate occurrence: within 10 min -> canComment: false
    const res1 = index.recordOccurrence('fp_throttle', now + 1000);
    expect(res1?.canComment).toBe(false);
    expect(res1?.count).toBe(2);

    // Occurrence after 5 min -> canComment: false
    const res2 = index.recordOccurrence('fp_throttle', now + 5 * 60 * 1000);
    expect(res2?.canComment).toBe(false);
    expect(res2?.count).toBe(3);

    // Occurrence after 11 min -> canComment: true
    const res3 = index.recordOccurrence('fp_throttle', now + 11 * 60 * 1000);
    expect(res3?.canComment).toBe(true);
    expect(res3?.count).toBe(4);
  });
});
