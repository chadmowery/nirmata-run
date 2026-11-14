import { NextResponse, type NextRequest } from 'next/server';
import { CrashApproveRequestSchema, type ReportResult } from '@/shared/reports/schemas';
import { getLabelsForKind } from '@/shared/reports/labels';
import { computeCrashFingerprint } from '@/shared/reports/fingerprint';
import { getReportsStatus, getReportsServerConfig } from '@/server/reports/config';
import { reportsRateLimiter } from '@/server/reports/rate-limiter';
import {
  generateRefId,
  composeTitle,
  composeIssueBody,
  composeDedupeComment,
} from '@/server/reports/composer';
import { writeDryRunReport } from '@/server/reports/dry-run';
import { GitHubClient } from '@/server/reports/github-client';
import { getReportOutbox } from '@/server/reports/outbox';
import { readJsonBodyWithLimit } from '@/server/reports/body-limit';
import { draftStore } from '@/server/reports/draft-store';
import { buildAllowListedIssueSnapshot } from '@/server/utils/turn-snapshot';
import { fingerprintIndex } from '@/server/reports/fingerprint-index';
import { logger } from '@/engine/utils/logger';

export async function POST(req: NextRequest) {
  // 1. Status check (never consume rate limit while feature is off)
  const status = getReportsStatus();
  if (status.mode === 'off' || !status.available) {
    return NextResponse.json({ error: 'Issue reporting is currently unavailable' }, { status: 503 });
  }

  // 2. Bounded JSON read (<= 128 KB) & Zod validation
  const bodyRead = await readJsonBodyWithLimit(req);
  if (!bodyRead.ok) {
    return NextResponse.json({ error: bodyRead.error }, { status: bodyRead.status });
  }

  const parsed = CrashApproveRequestSchema.safeParse(bodyRead.data);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 }
    );
  }

  const data = parsed.data;

  // 3. Independent rate limit check (only after availability & schema validation succeed)
  const rate = reportsRateLimiter.consume('crash');
  if (!rate.allowed) {
    return NextResponse.json(
      { error: 'Reporting is temporarily busy, try again later' },
      { status: 429, headers: { 'Retry-After': String(rate.retryAfterSeconds) } }
    );
  }

  const cfg = getReportsServerConfig();
  const ref = generateRefId();
  const labels = getLabelsForKind('CRASH');

  let title = '';
  let body = '';
  let fingerprint = '';
  let sessionId = data.sessionId;
  let floor: number | undefined;
  let turn: number | undefined;
  let build: string | undefined;

  // 4. Resolve crash details (server draft vs client report)
  if ('draftId' in data) {
    const draft = draftStore.redeem(data.draftId, data.sessionId);
    if (!draft) {
      return NextResponse.json(
        { error: 'Crash draft expired or not found for this session' },
        { status: 404 }
      );
    }

    fingerprint = draft.fingerprint;
    floor = draft.sealed.floor;
    turn = draft.sealed.turn;
    build = cfg.buildSha;

    title = composeTitle({
      kind: 'CRASH',
      errorName: draft.sealed.errorName,
      errorMessage: draft.sealed.errorMessage,
    });

    body = composeIssueBody({
      ref,
      kind: 'CRASH',
      crashSource: draft.source,
      fingerprint: draft.fingerprint,
      errorName: draft.sealed.errorName,
      errorMessage: draft.sealed.errorMessage,
      stack: draft.sealed.stack,
      failedAction: draft.sealed.action,
      stateSnapshot: buildAllowListedIssueSnapshot(draft.sealed),
      note: data.note,
      sessionId: data.sessionId,
      build: cfg.buildSha,
      mode: draft.sealed.mode,
      floor: draft.sealed.floor,
      turn: draft.sealed.turn,
      phase: draft.sealed.phase,
      title,
    });
  } else {
    // Client-origin crash: server recomputes fingerprint
    fingerprint = computeCrashFingerprint(
      data.source,
      data.error.name,
      data.error.message,
      data.error.stack
    );

    floor = data.diagnostics.floor;
    turn = data.diagnostics.turn;
    build = data.diagnostics.build;
    sessionId = data.sessionId;

    title = composeTitle({
      kind: 'CRASH',
      errorName: data.error.name,
      errorMessage: data.error.message,
    });

    body = composeIssueBody({
      ref,
      kind: 'CRASH',
      crashSource: data.source,
      fingerprint,
      errorName: data.error.name,
      errorMessage: data.error.message,
      stack: data.error.stack,
      note: data.note,
      diagnostics: data.diagnostics,
      sessionId: data.sessionId,
      title,
    });
  }

  // 5. Deduplication check
  let existingEntry = fingerprintIndex.get(fingerprint);

  const client = new GitHubClient({
    token: cfg.githubToken,
    repo: cfg.githubRepo,
  });

  // Fallback search if index missed and running live
  if (!existingEntry && status.mode === 'live') {
    try {
      const searchedIssue = await client.searchIssueByFingerprint(fingerprint);
      if (searchedIssue) {
        fingerprintIndex.recordNewIssue(fingerprint, searchedIssue);
        existingEntry = fingerprintIndex.get(fingerprint);
      }
    } catch {
      // Non-fatal search failure
    }
  }

  // Deduplication handling if existing issue exists
  if (existingEntry) {
    let isOpen = true;
    if (status.mode === 'live') {
      try {
        const issueState = await client.getIssue(existingEntry.issueNumber);
        isOpen = issueState.state === 'open';
      } catch {
        // If lookup fails, assume open to be safe
        isOpen = true;
      }
    }

    if (isOpen) {
      const occurrence = fingerprintIndex.recordOccurrence(fingerprint);
      const count = occurrence ? occurrence.count : existingEntry.count + 1;
      const canComment = occurrence ? occurrence.canComment : true;

      if (canComment) {
        const commentBody = composeDedupeComment({
          ref,
          count,
          build,
          floor,
          turn,
          sessionId,
          note: data.note,
        });

        if (status.mode === 'dry-run') {
          writeDryRunReport({
            ref,
            type: 'comment',
            body: commentBody,
            issueNumber: existingEntry.issueNumber,
          });
          return NextResponse.json({ status: 'dry-run', ref } satisfies ReportResult);
        }

        try {
          await client.addComment(existingEntry.issueNumber, commentBody);
          return NextResponse.json({ status: 'commented', ref } satisfies ReportResult);
        } catch (err) {
          logger.warn(`Failed to post dedupe comment for ${ref}; queuing in outbox`, 'REPORTS', {
            err: String(err),
          });
          getReportOutbox().enqueue({
            ref,
            action: 'add-comment',
            issueNumber: existingEntry.issueNumber,
            body: commentBody,
          });
          return NextResponse.json({ status: 'queued', ref } satisfies ReportResult);
        }
      }

      // Throttled (commented within last 10m): local counter updated, report acknowledged
      return NextResponse.json({ status: 'commented', ref } satisfies ReportResult);
    }
  }

  // 6. Create new crash issue
  if (status.mode === 'dry-run') {
    fingerprintIndex.recordNewIssue(fingerprint, 99999);
    writeDryRunReport({
      ref,
      type: 'issue',
      title,
      body,
      labels,
    });
    return NextResponse.json({ status: 'dry-run', ref } satisfies ReportResult);
  }

  try {
    await client.ensureLabels(labels);
    const created = await client.createIssue({ title, body, labels });
    fingerprintIndex.recordNewIssue(fingerprint, created.number);
    return NextResponse.json({ status: 'created', ref } satisfies ReportResult);
  } catch (err) {
    logger.warn(`Failed to create crash issue for ${ref}; queuing in outbox`, 'REPORTS', {
      err: String(err),
    });
    getReportOutbox().enqueue({
      ref,
      action: 'create-issue',
      title,
      body,
      labels,
      fingerprint,
    });
    return NextResponse.json({ status: 'queued', ref } satisfies ReportResult);
  }
}
