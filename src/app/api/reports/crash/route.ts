import { NextResponse, type NextRequest } from 'next/server';
import { CrashApproveRequestSchema } from '@shared/reports/schemas';
import { getLabelsForKind } from '@shared/reports/labels';
import { computeCrashFingerprint } from '@shared/reports/fingerprint';
import { getReportsStatus, getReportsServerConfig } from '@server/reports/config';
import { reportsRateLimiter } from '@server/reports/rate-limiter';
import {
  generateRefId,
  composeTitle,
  type IssueComposeParams,
} from '@server/reports/composer';
import { getReportOutbox } from '@server/reports/outbox';
import { readJsonBodyWithLimit } from '@server/reports/body-limit';
import { draftStore } from '@server/reports/draft-store';
import { buildAllowListedIssueSnapshot } from '@server/utils/turn-snapshot';
import { deliverCrashReport } from '@server/reports/delivery';

export async function POST(req: NextRequest) {
  // 1. Status check (never consume rate limit while feature is off)
  const status = getReportsStatus();
  if (status.mode === 'off' || !status.available) {
    return NextResponse.json({ error: 'Crash reporting is currently unavailable' }, { status: 503 });
  }

  // 2. Bounded body read (128 KB cap) and Zod validation before consuming rate limit
  const bodyResult = await readJsonBodyWithLimit(req);
  if (!bodyResult.ok) {
    return NextResponse.json({ error: bodyResult.error }, { status: bodyResult.status });
  }

  const parsed = CrashApproveRequestSchema.safeParse(bodyResult.data);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid crash approval payload', details: parsed.error.issues },
      { status: 400 }
    );
  }
  const data = parsed.data;

  // 3. Rate limit check (crash: 40/hr)
  const rate = reportsRateLimiter.consume('crash');
  if (!rate.allowed) {
    return NextResponse.json(
      { error: 'Reporting is temporarily busy, try again later' },
      { status: 429, headers: { 'Retry-After': String(rate.retryAfterSeconds) } }
    );
  }

  const cfg = getReportsServerConfig();
  const ref = generateRefId((candidate) => getReportOutbox().hasRef(candidate));
  const labels = getLabelsForKind('CRASH');

  let title = '';
  let composeParams: IssueComposeParams;
  let fingerprint = '';
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

    composeParams = {
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
    };
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

    title = composeTitle({
      kind: 'CRASH',
      errorName: data.error.name,
      errorMessage: data.error.message,
    });

    composeParams = {
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
    };
  }

  // 5. Delegate deduplication, concurrency locking, and GitHub/dry-run delivery
  const outcome = await deliverCrashReport({
    cfg,
    status,
    ref,
    fingerprint,
    title,
    labels,
    composeParams,
    dedupeContext: {
      build,
      floor,
      turn,
      sessionId: data.sessionId,
      note: data.note,
    },
  });

  return NextResponse.json(outcome.payload, { status: outcome.statusCode });
}
